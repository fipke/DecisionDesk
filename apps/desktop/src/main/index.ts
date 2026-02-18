import { app, BrowserWindow, ipcMain, shell, Notification } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import Store from 'electron-store';
import { WhisperService } from './whisper';
import { QueueService } from './queue';
import { ApiService } from './api';
import { initDatabase, closeDatabase } from './database';
import { ConnectivityService } from './connectivity';
import { SyncService } from './syncService';
import * as repo from './repositories';

// Store for app settings (simple key-value, not entities)
const store = new Store({
  defaults: {
    apiUrl: 'http://localhost:8087',
    whisperModel: 'large-v3',
    enableDiarization: true,
    autoAcceptJobs: false,
    notificationsEnabled: true
  }
});

let mainWindow: BrowserWindow | null = null;
let whisperService: WhisperService;
let queueService: QueueService;
let apiService: ApiService;
let connectivityService: ConnectivityService;
let syncService: SyncService;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f172a', // slate-950
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // Dev mode: load from vite server
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// ─── Initialize services ─────────────────────────────────────

function initializeServices(): void {
  const apiUrl = store.get('apiUrl') as string;

  // 1. SQLite database (offline-first)
  initDatabase();

  // 2. Whisper (local transcription)
  whisperService = new WhisperService({
    modelsPath: getModelsPath(),
    whisperPath: getWhisperPath(),
    diarizePath: getDiarizePath()
  });

  // 3. API client
  apiService = new ApiService(apiUrl);

  // 4. Connectivity monitor
  connectivityService = new ConnectivityService(apiUrl);
  connectivityService.start(15_000);

  // Forward connectivity events to renderer
  connectivityService.on('status', (status) => {
    mainWindow?.webContents.send('connectivity:status-changed', status);
  });

  // 5. Sync service (outbox drain)
  syncService = new SyncService(connectivityService, apiService);

  // 6. Transcription queue (desktop ↔ backend)
  queueService = new QueueService(apiService, whisperService, {
    onJobReceived: (job) => {
      if (store.get('notificationsEnabled')) {
        new Notification({
          title: 'Nova Transcrição',
          body: `Meeting ${job.meetingId.slice(0, 8)}... aguardando processamento`
        }).show();
      }
      mainWindow?.webContents.send('queue:job-received', job);
    },
    onJobCompleted: (meetingId) => {
      mainWindow?.webContents.send('queue:job-completed', meetingId);
    },
    onJobFailed: (meetingId, error) => {
      mainWindow?.webContents.send('queue:job-failed', { meetingId, error });
    }
  });
}

function getWhisperPath(): string {
  if (is.dev) return '/opt/homebrew/bin/whisper-cli';
  return join(process.resourcesPath, 'whisper', 'whisper-cli');
}

function getModelsPath(): string {
  if (is.dev) return join(app.getPath('home'), '.whisper', 'models');
  return join(process.resourcesPath, 'whisper', 'models');
}

function getDiarizePath(): string {
  if (is.dev) return join(__dirname, '../../resources/scripts/diarize.py');
  return join(process.resourcesPath, 'scripts', 'diarize.py');
}

// ─── IPC Handlers ────────────────────────────────────────────

function setupIPC(): void {
  // ── Settings ──
  ipcMain.handle('settings:get', () => store.store);
  ipcMain.handle('settings:set', (_, key: string, value: unknown) => {
    store.set(key, value);
    if (key === 'apiUrl') {
      apiService.setBaseUrl(value as string);
      connectivityService.setBackendUrl(value as string);
    }
    return store.store;
  });

  // ── Queue (backend transcription jobs) ──
  ipcMain.handle('queue:get-pending', () => queueService.getPendingJobs());
  ipcMain.handle('queue:accept-job', (_, meetingId: string) => queueService.acceptJob(meetingId));
  ipcMain.handle('queue:process-job', (_, meetingId: string) => queueService.processJob(meetingId));

  // ── Whisper ──
  ipcMain.handle('whisper:get-status', () => ({
    available: whisperService.isAvailable(),
    models: whisperService.getAvailableModels()
  }));
  ipcMain.handle('whisper:transcribe', (_, audioPath: string, options) =>
    whisperService.transcribe(audioPath, options)
  );

  // ── API ──
  ipcMain.handle('api:set-url', (_, url: string) => {
    store.set('apiUrl', url);
    apiService = new ApiService(url);
    connectivityService.setBackendUrl(url);
  });

  // ── Connectivity ──
  ipcMain.handle('connectivity:get-status', () => ({
    online: connectivityService.online,
    backendReachable: connectivityService.backendReachable
  }));

  // ── Database: Meetings ──
  ipcMain.handle('db:meetings:list', () => repo.listMeetings());
  ipcMain.handle('db:meetings:list-by-folder', (_, folderId: string) => repo.listMeetingsByFolder(folderId));
  ipcMain.handle('db:meetings:get', (_, id: string) => repo.getMeeting(id));
  ipcMain.handle('db:meetings:upsert', (_, meeting) => repo.upsertMeeting(meeting));
  ipcMain.handle('db:meetings:delete', (_, id: string) => repo.deleteMeeting(id));

  // ── Database: Folders ──
  ipcMain.handle('db:folders:list', () => repo.listFolders());
  ipcMain.handle('db:folders:get', (_, id: string) => repo.getFolder(id));
  ipcMain.handle('db:folders:upsert', (_, folder) => repo.upsertFolder(folder));
  ipcMain.handle('db:folders:delete', (_, id: string) => repo.deleteFolder(id));

  // ── Database: Meeting Types ──
  ipcMain.handle('db:meeting-types:list', () => repo.listMeetingTypes());
  ipcMain.handle('db:meeting-types:get', (_, id: string) => repo.getMeetingType(id));
  ipcMain.handle('db:meeting-types:upsert', (_, mt) => repo.upsertMeetingType(mt));

  // ── Database: People ──
  ipcMain.handle('db:people:list', () => repo.listPeople());
  ipcMain.handle('db:people:get', (_, id: string) => repo.getPerson(id));
  ipcMain.handle('db:people:upsert', (_, p) => repo.upsertPerson(p));
  ipcMain.handle('db:people:delete', (_, id: string) => repo.deletePerson(id));

  // ── Database: Meeting × People ──
  ipcMain.handle('db:meeting-people:list', (_, meetingId: string) => repo.listMeetingPeople(meetingId));
  ipcMain.handle('db:meeting-people:add', (_, mp) => repo.addMeetingPerson(mp));
  ipcMain.handle('db:meeting-people:remove', (_, meetingId: string, personId: string, role: string) =>
    repo.removeMeetingPerson(meetingId, personId, role)
  );

  // ── Database: Note Blocks ──
  ipcMain.handle('db:note-blocks:list', (_, meetingId: string) => repo.listNoteBlocks(meetingId));
  ipcMain.handle('db:note-blocks:upsert', (_, nb) => repo.upsertNoteBlock(nb));
  ipcMain.handle('db:note-blocks:delete', (_, id: string) => repo.deleteNoteBlock(id));

  // ── Database: Summaries ──
  ipcMain.handle('db:summaries:list', (_, meetingId: string) => repo.listSummaries(meetingId));
  ipcMain.handle('db:summaries:upsert', (_, s) => repo.upsertSummary(s));

  // ── Database: Meeting Series ──
  ipcMain.handle('db:series:list', () => repo.listMeetingSeries());
  ipcMain.handle('db:series:upsert', (_, ms) => repo.upsertMeetingSeries(ms));
  ipcMain.handle('db:series-entries:list', (_, seriesId: string) => repo.listSeriesEntries(seriesId));
  ipcMain.handle('db:series-entries:add', (_, entry) => repo.addSeriesEntry(entry));

  // ── Database: Templates ──
  ipcMain.handle('db:templates:list', () => repo.listTemplates());
  ipcMain.handle('db:templates:upsert', (_, t) => repo.upsertTemplate(t));
  ipcMain.handle('db:templates:delete', (_, id: string) => repo.deleteTemplate(id));

  // ── Sync ──
  ipcMain.handle('db:sync:count', () => repo.syncQueueCount());
  ipcMain.handle('db:sync:trigger', () => syncService.drain());
}

// ─── Single instance lock ────────────────────────────────────

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // App lifecycle
  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.decisiondesk.desktop');

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    initializeServices();
    setupIPC();
    createWindow();

    // Start polling for backend transcription jobs
    queueService.startPolling(10000);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    queueService.stopPolling();
    connectivityService.stop();
    closeDatabase();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
