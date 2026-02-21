import { app, BrowserWindow, dialog, ipcMain, shell, Notification } from 'electron';
import { join } from 'path';
import { writeFileSync, mkdirSync, existsSync, createReadStream } from 'fs';
import { randomUUID } from 'crypto';
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
    backgroundColor: '#0b0e18', // dd-base
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
    diarizePath: getDiarizePath(),
    diarizeVenvPython: getDiarizeVenvPython(),
    huggingfaceToken: (store.get('huggingfaceToken') as string | undefined) ?? undefined
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
        const notif = new Notification({
          title: 'Nova Transcrição',
          body: `Meeting ${job.meetingId.slice(0, 8)}... aguardando processamento`
        });
        notif.on('click', () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('navigate', '/queue');
          }
        });
        notif.show();
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

function getDiarizeVenvPython(): string {
  if (is.dev) return join(__dirname, '../../resources/diarize-venv/bin/python');
  return join(process.resourcesPath, 'diarize-venv', 'bin', 'python');
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
    if (key === 'huggingfaceToken') {
      whisperService.setHuggingfaceToken(value as string);
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
  ipcMain.handle('whisper:diarize', (_, audioPath: string) =>
    whisperService.diarize(audioPath)
  );

  // ── API ──
  ipcMain.handle('api:set-url', (_, url: string) => {
    store.set('apiUrl', url);
    apiService = new ApiService(url);
    connectivityService.setBackendUrl(url);
  });

  ipcMain.handle('api:meetings:list', async () => {
    try {
      const data = await apiService.fetchAllMeetings();
      // Normalize backend response to match local Meeting shape
      return data.map((m: any) => ({
        id: m.id,
        remoteId: m.id,
        createdAt: m.createdAt,
        status: m.status,
        title: m.title ?? null,
        updatedAt: m.updatedAt ?? null,
        durationSec: m.durationSec ?? null,
        minutes: m.minutes ?? null,
        meetingTypeId: m.meetingTypeId ?? null,
        meetingTypeName: m.meetingTypeName ?? null,
      }));
    } catch {
      return [];
    }
  });

  ipcMain.handle('api:meetings:get', async (_, id: string) => {
    try {
      const remote = await apiService.fetchMeeting(id);
      // Normalize backend MeetingDetailsResponse to match local Meeting shape
      return {
        id: remote.id,
        remoteId: remote.id,
        createdAt: remote.createdAt,
        status: remote.status,
        title: remote.title ?? null,
        updatedAt: null,
        transcriptText: remote.transcriptText ?? remote.transcript?.text ?? null,
        language: remote.language ?? remote.transcript?.language ?? null,
        costUsd: remote.cost?.total?.usd ?? null,
        costBrl: remote.cost?.total?.brl ?? null,
        durationSec: remote.durationSec ?? null,
        minutes: remote.minutes ?? null,
        recordingUri: null,
        folderId: null,
        meetingTypeId: null,
        tags: null,
      };
    } catch {
      return null;
    }
  });

  // ── API: Transcription + Reset ──
  ipcMain.handle('api:meetings:transcribe', (_, meetingId: string, options?: { provider?: string; model?: string; enableDiarization?: boolean }) =>
    apiService.transcribeMeeting(meetingId, options));
  ipcMain.handle('api:meetings:reset-status', (_, meetingId: string) =>
    apiService.resetMeetingStatus(meetingId));
  ipcMain.handle('api:meetings:audio-url', (_, meetingId: string) =>
    apiService.getAudioUrl(meetingId));
  ipcMain.handle('api:meetings:download-audio', (_, meetingId: string) =>
    apiService.downloadAudio(meetingId, `/api/v1/meetings/${meetingId}/audio`));

  // ── API: Template CRUD ──
  ipcMain.handle('api:templates:create', (_, payload) => apiService.createTemplateFn(payload));
  ipcMain.handle('api:templates:update', (_, id: string, payload) => apiService.updateTemplateFn(id, payload));
  ipcMain.handle('api:templates:delete', (_, id: string) => apiService.deleteTemplate(id));
  ipcMain.handle('api:templates:set-default', (_, id: string) => apiService.setDefaultTemplate(id));

  // ── API: People CRUD ──
  ipcMain.handle('api:people:create', (_, payload) => apiService.createPerson(payload));
  ipcMain.handle('api:people:update', (_, id: string, payload) => apiService.updatePerson(id, payload));
  ipcMain.handle('api:people:delete', (_, id: string) => apiService.deletePerson(id));

  // ── API: Stats (Dashboard) ──
  ipcMain.handle('api:stats:get', () => apiService.fetchStats());
  ipcMain.handle('api:stats:calendar', (_, from: string, to: string) => apiService.fetchCalendar(from, to));

  // ── Recording ──
  ipcMain.handle('recording:save', async (_, arrayBuffer: ArrayBuffer) => {
    const recordingsDir = join(app.getPath('userData'), 'recordings');
    if (!existsSync(recordingsDir)) mkdirSync(recordingsDir, { recursive: true });
    const id = randomUUID();
    const filePath = join(recordingsDir, `${id}.webm`);
    writeFileSync(filePath, Buffer.from(arrayBuffer));
    return filePath;
  });

  ipcMain.handle('recording:create-meeting', (_, filePath: string, liveNotes?: string) => {
    const id = randomUUID();
    const now = new Date().toISOString();
    // upsertMeeting auto-enqueues sync when enqueueSync=true (default)
    const meeting = repo.upsertMeeting({
      id,
      createdAt: now,
      status: 'PENDING_SYNC',
      recordingUri: filePath,
      title: null,
      updatedAt: now,
    });

    // Save live notes as a note block if provided
    if (liveNotes) {
      repo.upsertNoteBlock({
        meetingId: id,
        blockType: 'paragraph',
        content: liveNotes,
      });
    }

    return meeting;
  });

  // ── Connectivity ──
  ipcMain.handle('connectivity:get-status', () => ({
    online: connectivityService.online,
    backendReachable: connectivityService.backendReachable
  }));

  // ── Import ──
  ipcMain.handle('import:open-audio-file', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar áudio',
      filters: [{ name: 'Áudio', extensions: ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'flac', 'aac'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('import:upload-audio', async (_, filePath: string, title?: string) => {
    // 1. Create meeting shell
    const createRes = await apiService['client'].post('/api/v1/meetings');
    const meetingId = createRes.data.id;

    // 2. Upload audio to the meeting
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', createReadStream(filePath));
    await apiService['client'].post(`/api/v1/meetings/${meetingId}/audio`, form, {
      headers: form.getHeaders(),
    });

    // 3. Update title if provided
    if (title) {
      await apiService['client'].put(`/api/v1/meetings/${meetingId}`, { title });
    }

    return createRes.data;
  });

  ipcMain.handle('import:text', async (_, text: string, title?: string) => {
    const response = await apiService['client'].post('/api/v1/import/text', { text, title });
    return response.data;
  });

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

  // ── Database: Transcript Segments ──
  ipcMain.handle('db:segments:list', (_, meetingId: string) => repo.listSegments(meetingId));
  ipcMain.handle('db:segments:insert-batch', (_, meetingId: string, segments) =>
    repo.insertSegmentsBatch(meetingId, segments));
  ipcMain.handle('db:segments:delete', (_, meetingId: string) => repo.deleteSegments(meetingId));
  ipcMain.handle('db:segments:update-speaker', (_, segmentId: string, speakerId: string, speakerLabel: string) =>
    repo.updateSegmentSpeaker(segmentId, speakerId, speakerLabel));

  // ── Database: Meeting Speakers ──
  ipcMain.handle('db:speakers:list', (_, meetingId: string) => repo.listMeetingSpeakers(meetingId));
  ipcMain.handle('db:speakers:upsert', (_, speaker) => repo.upsertMeetingSpeaker(speaker));
  ipcMain.handle('db:speakers:delete', (_, id: string) => repo.deleteMeetingSpeaker(id));
  ipcMain.handle('db:speakers:merge', (_, meetingId: string, keepId: string, absorbId: string) =>
    repo.mergeSpeakers(meetingId, keepId, absorbId));

  // ── API: Templates + Summaries ──
  ipcMain.handle('api:templates:list', () => apiService.fetchTemplates());
  ipcMain.handle('api:summary:generate', (_, meetingId: string, templateId?: string) =>
    apiService.generateSummary(meetingId, templateId));
  ipcMain.handle('api:summary:get', (_, meetingId: string) => apiService.fetchSummary(meetingId));

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
