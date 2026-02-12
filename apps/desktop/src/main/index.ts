import { app, BrowserWindow, ipcMain, shell, Notification } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import Store from 'electron-store';
import { WhisperService } from './whisper';
import { QueueService } from './queue';
import { ApiService } from './api';

// Store for app settings
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

// Initialize services
function initializeServices(): void {
  const apiUrl = store.get('apiUrl') as string;
  
  whisperService = new WhisperService({
    modelsPath: getModelsPath(),
    whisperPath: getWhisperPath(),
    diarizePath: getDiarizePath()
  });

  apiService = new ApiService(apiUrl);
  
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
  if (is.dev) {
    return '/opt/homebrew/bin/whisper-cli';
  }
  return join(process.resourcesPath, 'whisper', 'whisper-cli');
}

function getModelsPath(): string {
  if (is.dev) {
    return join(app.getPath('home'), '.whisper', 'models');
  }
  return join(process.resourcesPath, 'whisper', 'models');
}

function getDiarizePath(): string {
  if (is.dev) {
    return join(__dirname, '../../resources/scripts/diarize.py');
  }
  return join(process.resourcesPath, 'scripts', 'diarize.py');
}

// IPC handlers
function setupIPC(): void {
  // Settings
  ipcMain.handle('settings:get', () => store.store);
  ipcMain.handle('settings:set', (_, key: string, value: unknown) => {
    store.set(key, value);
    return store.store;
  });

  // Queue
  ipcMain.handle('queue:get-pending', async () => {
    return queueService.getPendingJobs();
  });
  
  ipcMain.handle('queue:accept-job', async (_, meetingId: string) => {
    return queueService.acceptJob(meetingId);
  });

  ipcMain.handle('queue:process-job', async (_, meetingId: string) => {
    return queueService.processJob(meetingId);
  });

  // Whisper
  ipcMain.handle('whisper:get-status', () => ({
    available: whisperService.isAvailable(),
    models: whisperService.getAvailableModels()
  }));

  ipcMain.handle('whisper:transcribe', async (_, audioPath: string, options: {
    model: string;
    language: string;
    enableDiarization: boolean;
  }) => {
    return whisperService.transcribe(audioPath, options);
  });

  // API
  ipcMain.handle('api:set-url', (_, url: string) => {
    store.set('apiUrl', url);
    apiService = new ApiService(url);
  });
}

// Single instance lock - reuse existing window
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window
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

    // Start polling for jobs
    queueService.startPolling(10000); // Poll every 10 seconds

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    queueService.stopPolling();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
