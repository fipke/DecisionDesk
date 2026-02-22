import { app, BrowserWindow, dialog, ipcMain, shell, Notification, protocol } from 'electron';
import { join } from 'path';
import { writeFileSync, mkdirSync, existsSync, createReadStream, statSync } from 'fs';
import { randomUUID } from 'crypto';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import Store from 'electron-store';
import { WhisperService } from './whisper';
import { QueueService } from './queue';
import { ApiService } from './api';
import { OllamaService } from './ollamaService';
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
    notificationsEnabled: true,
    preferLocal: true,
    aiConfig: {
      summarization: { provider: 'ollama', model: 'qwen3:14b' },
      extraction: { provider: 'ollama', model: 'qwen3:14b' },
      chat: { provider: 'ollama', model: 'qwen3:14b' },
    }
  }
});

function buildActionItemsPrompt(transcript: string, participantNames: string[]): string {
  const ctx = participantNames.length > 0
    ? `\nParticipantes conhecidos: ${participantNames.join(', ')}\n`
    : '';
  return `Extraia todos os itens de ação (tarefas, compromissos, pendências) desta transcrição.
${ctx}
Retorne APENAS um array JSON no formato:
[{"content": "Descrição clara da tarefa", "assignee": "Nome do responsável ou null", "dueDate": "YYYY-MM-DD ou null"}]

Regras:
- Inclua APENAS tarefas concretas e acionáveis
- Se alguém disse "vou fazer X", isso é um action item atribuído a essa pessoa
- Se alguém disse "precisamos fazer X" sem responsável, assignee = null
- Datas relativas como "semana que vem" devem ser convertidas para data ISO
- NÃO inclua decisões, observações ou tópicos de discussão — apenas tarefas

TRANSCRIÇÃO:
${transcript.substring(0, 6000)}`;
}

let mainWindow: BrowserWindow | null = null;
let whisperService: WhisperService;
let queueService: QueueService;
let apiService: ApiService;
let ollamaService: OllamaService;
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

  // 4. Ollama (local AI)
  ollamaService = new OllamaService();

  // 5. Connectivity monitor
  connectivityService = new ConnectivityService(apiUrl);
  connectivityService.start(15_000);

  // Forward connectivity events to renderer
  connectivityService.on('status', (status) => {
    mainWindow?.webContents.send('connectivity:status-changed', status);
  });

  // 6. Sync service (outbox drain + pull)
  syncService = new SyncService(connectivityService, apiService);

  // Pull templates from backend on startup and when backend becomes reachable
  connectivityService.on('backend-reachable', () => {
    syncService.pullTemplates().catch(() => {});
  });

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
  ipcMain.handle('db:series-entries:add', (_, entry) => repo.addSeriesEntryWithSync(entry));
  ipcMain.handle('db:series-entries:remove', (_, meetingId: string, seriesId: string) => repo.removeSeriesEntry(meetingId, seriesId));
  ipcMain.handle('db:series:next-ordinal', (_, seriesId: string) => repo.getNextOrdinalForSeries(seriesId));

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
  ipcMain.handle('api:summary:generate', async (_, meetingId: string, templateId?: string) => {
    // Ensure transcript is on the backend before generating summary
    const meeting = repo.getMeeting(meetingId);
    if (meeting?.transcriptText) {
      await apiService.pushTranscript(meetingId, meeting.transcriptText, meeting.language ?? 'pt');
    }
    const result = await apiService.generateSummary(meetingId, templateId);
    // Save cloud-generated summary to local SQLite for offline access
    if (result?.id) {
      repo.upsertSummary({
        id: result.id,
        meetingId,
        provider: 'cloud',
        model: result.model ?? 'unknown',
        style: 'cloud',
        bodyMarkdown: result.textMd ?? result.text ?? '',
      }, false);
    }
    // Auto-extract action items after cloud summary
    if (repo.listActionItems(meetingId).length === 0 && meeting?.transcriptText) {
      const aiConfig = store.get('aiConfig') as any;
      const extractModel = aiConfig?.extraction?.model ?? 'qwen3:14b';
      const people = repo.listPeople();
      const meetingPeople = repo.listMeetingPeople(meetingId);
      const names = meetingPeople
        .map(mp => people.find(p => p.id === mp.personId))
        .filter(Boolean)
        .map(p => p!.displayName);
      ollamaService.generateSummary({
        model: extractModel,
        systemPrompt: 'You are a meeting assistant that extracts action items from meeting transcripts. Extract ONLY concrete tasks, to-dos, and commitments. Return ONLY a JSON array, no other text. Always respond in the same language as the transcript.',
        userPrompt: buildActionItemsPrompt(meeting.transcriptText, names),
        maxTokens: 2000,
        temperature: 0.2,
        think: false,
      }).then(r => {
        let c = r.content.trim();
        const m = c.match(/\[[\s\S]*\]/);
        if (m) c = m[0];
        const items = JSON.parse(c);
        const sid = repo.getSeriesIdForMeeting(meetingId);
        repo.insertActionItemsBatch(meetingId, sid, items, people);
        mainWindow?.webContents.send('action-items:extracted', meetingId);
      }).catch(err => {
        console.warn('[ActionItems] Auto-extraction after cloud summary failed:', err?.message);
      });
    }

    return result;
  });
  ipcMain.handle('api:summary:get', (_, meetingId: string) => apiService.fetchSummary(meetingId));

  // ── Ollama (local AI) ──
  ipcMain.handle('ollama:check', () => ollamaService.isAvailable());
  ipcMain.handle('ollama:models', () => ollamaService.listModels());
  ipcMain.handle('ollama:generate-summary', async (_, meetingId: string, templateId?: string) => {
    const meeting = repo.getMeeting(meetingId);
    if (!meeting?.transcriptText) {
      throw new Error('No transcript available for this meeting');
    }

    // Find template
    const templates = repo.listTemplates();
    const template = templateId
      ? templates.find(t => t.id === templateId)
      : templates.find(t => t.isDefault) ?? templates[0];
    if (!template?.userPromptTemplate) {
      throw new Error('No template with prompt found. Pull templates from backend or create one.');
    }

    // Resolve model from aiConfig > template > default
    const aiConfig = store.get('aiConfig') as any;
    const model = aiConfig?.summarization?.model ?? template.model ?? 'qwen3:14b';

    // Build prompt
    const userPrompt = template.userPromptTemplate.replace('{{transcript}}', meeting.transcriptText);
    const systemPrompt = template.systemPrompt ?? '';

    const result = await ollamaService.generateSummary({
      model,
      systemPrompt,
      userPrompt,
      maxTokens: template.maxTokens ?? 2000,
      temperature: template.temperature ?? 0.3,
    });

    // Save to local SQLite
    const summary = repo.upsertSummary({
      meetingId,
      provider: 'ollama',
      model: result.model,
      style: template.name,
      bodyMarkdown: result.content,
    });

    // Auto-extract action items if none exist yet
    if (repo.listActionItems(meetingId).length === 0 && meeting.transcriptText) {
      const extractModel = aiConfig?.extraction?.model ?? model;
      const meetingPeople = repo.listMeetingPeople(meetingId);
      const people = repo.listPeople();
      const names = meetingPeople
        .map(mp => people.find(p => p.id === mp.personId))
        .filter(Boolean)
        .map(p => p!.displayName);
      ollamaService.generateSummary({
        model: extractModel,
        systemPrompt: 'You are a meeting assistant that extracts action items from meeting transcripts. Extract ONLY concrete tasks, to-dos, and commitments. Return ONLY a JSON array, no other text. Always respond in the same language as the transcript.',
        userPrompt: buildActionItemsPrompt(meeting.transcriptText, names),
        maxTokens: 2000,
        temperature: 0.2,
        think: false,
      }).then(r => {
        let c = r.content.trim();
        const m = c.match(/\[[\s\S]*\]/);
        if (m) c = m[0];
        const items = JSON.parse(c);
        const sid = repo.getSeriesIdForMeeting(meetingId);
        repo.insertActionItemsBatch(meetingId, sid, items, people);
        mainWindow?.webContents.send('action-items:extracted', meetingId);
      }).catch(err => {
        console.warn('[ActionItems] Auto-extraction failed:', err?.message);
      });
    }

    return {
      id: summary.id,
      text: result.content,
      model: result.model,
      tokensUsed: result.promptTokens + result.completionTokens,
    };
  });

  // ── Ollama: Custom prompt summary ──
  ipcMain.handle('ollama:generate-summary-custom', async (_, meetingId: string, customPrompt: string) => {
    const meeting = repo.getMeeting(meetingId);
    if (!meeting?.transcriptText) {
      throw new Error('No transcript available for this meeting');
    }

    const aiConfig = store.get('aiConfig') as any;
    const model = aiConfig?.summarization?.model ?? 'qwen3:14b';

    const systemPrompt = 'You are a helpful meeting assistant. Always respond in the same language as the transcript.';
    const userPrompt = `${customPrompt}\n\n---\nTRANSCRIÇÃO:\n${meeting.transcriptText}`;

    const result = await ollamaService.generateSummary({
      model,
      systemPrompt,
      userPrompt,
      maxTokens: 2000,
      temperature: 0.3,
    });

    const summary = repo.upsertSummary({
      meetingId,
      provider: 'ollama',
      model: result.model,
      style: 'custom',
      bodyMarkdown: result.content,
    });

    return {
      id: summary.id,
      text: result.content,
      model: result.model,
      tokensUsed: result.promptTokens + result.completionTokens,
    };
  });

  // ── API: Custom prompt summary ──
  ipcMain.handle('api:summary:generate-custom', async (_, meetingId: string, customPrompt: string) => {
    const meeting = repo.getMeeting(meetingId);
    if (meeting?.transcriptText) {
      await apiService.pushTranscript(meetingId, meeting.transcriptText, meeting.language ?? 'pt');
    }
    const result = await apiService.generateSummaryCustom(meetingId, customPrompt);
    if (result?.id) {
      repo.upsertSummary({
        id: result.id,
        meetingId,
        provider: 'cloud',
        model: result.model ?? 'unknown',
        style: 'custom',
        bodyMarkdown: result.textMd ?? result.text ?? '',
      }, false);
    }
    return result;
  });

  // ── Chat: Local (Ollama) ──
  ipcMain.handle('ollama:chat', async (_, meetingId: string, message: string) => {
    const meeting = repo.getMeeting(meetingId);
    if (!meeting?.transcriptText) {
      throw new Error('No transcript available for this meeting');
    }

    const aiConfig = store.get('aiConfig') as any;
    const model = aiConfig?.chat?.model ?? 'qwen3:14b';

    const systemPrompt = `You are a helpful meeting assistant. You have access to the full transcript of a meeting.
Answer the user's questions based on what was discussed in the meeting.
Always respond in the same language as the transcript.
Be concise and precise. If something was not discussed, say so.

Meeting transcript:
${meeting.transcriptText}`;

    const result = await ollamaService.generateSummary({
      model,
      systemPrompt,
      userPrompt: message,
      maxTokens: 1024,
      temperature: 0.5,
    });

    return {
      answer: result.content,
      provider: 'ollama',
      model: result.model,
      tokensUsed: result.promptTokens + result.completionTokens,
    };
  });

  // ── Chat: Cloud (Backend) ──
  ipcMain.handle('api:chat', async (_, meetingId: string, message: string) => {
    const meeting = repo.getMeeting(meetingId);
    if (meeting?.transcriptText) {
      await apiService.pushTranscript(meetingId, meeting.transcriptText, meeting.language ?? 'pt');
    }

    const aiConfig = store.get('aiConfig') as any;
    const provider = aiConfig?.chat?.provider ?? 'ollama';
    const model = aiConfig?.chat?.model ?? 'qwen3:14b';

    return apiService.chatWithMeeting(meetingId, message, provider, model);
  });

  // ── Snippet generation (one-line summary for meeting cards) ──
  ipcMain.handle('ollama:generate-snippet', async (_, meetingId: string, transcriptOverride?: string) => {
    const meeting = repo.getMeeting(meetingId);
    const transcript = transcriptOverride || meeting?.transcriptText;
    if (!transcript) throw new Error('No transcript');
    const aiConfig = store.get('aiConfig') as any;
    const model = aiConfig?.extraction?.model ?? 'qwen3:14b';
    const result = await ollamaService.generateSummary({
      model,
      systemPrompt: 'You are a meeting assistant. Respond ONLY with a single sentence summary, max 100 characters. Same language as input.',
      userPrompt: `Summarize this meeting in one sentence (max 100 chars):\n\n${transcript.substring(0, 3000)}`,
      maxTokens: 200,
      temperature: 0.2,
      think: false,
    });
    const snippet = result.content.trim().substring(0, 120);
    repo.updateSummarySnippet(meetingId, snippet);
    return snippet;
  });

  ipcMain.handle('api:generate-snippet', async (_, meetingId: string, transcriptOverride?: string) => {
    const meeting = repo.getMeeting(meetingId);
    const transcript = transcriptOverride || meeting?.transcriptText;
    if (!transcript) throw new Error('No transcript');
    await apiService.pushTranscript(meetingId, transcript, meeting?.language ?? 'pt');
    const result = await apiService.chatWithMeeting(
      meetingId,
      'Summarize this meeting in one sentence, max 100 characters. Same language as the transcript.',
    );
    const snippet = result.answer.trim().substring(0, 120);
    repo.updateSummarySnippet(meetingId, snippet);
    return snippet;
  });

  // ── AI Participant Extraction ──
  ipcMain.handle('ollama:extract-participants', async (_, meetingId: string) => {
    const meeting = repo.getMeeting(meetingId);
    if (!meeting?.transcriptText) throw new Error('No transcript');
    const aiConfig = store.get('aiConfig') as any;
    const model = aiConfig?.extraction?.model ?? 'qwen3:14b';
    const result = await ollamaService.generateSummary({
      model,
      systemPrompt: 'You are a meeting assistant. Extract all people mentioned or participating in this meeting. Return ONLY a JSON array, no other text.',
      userPrompt: `From this transcript, identify all people. Return JSON array: [{"name": "...", "role": "participant" or "mentioned", "confidence": 0.0-1.0}]. Role is "participant" (spoke/attended) or "mentioned" (referenced but not present).\n\nTRANSCRIPT:\n${meeting.transcriptText.substring(0, 4000)}`,
      maxTokens: 1000,
      temperature: 0.2,
      think: false,
    });
    let content = result.content.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) content = jsonMatch[0];
    return JSON.parse(content);
  });

  ipcMain.handle('api:extract-participants', async (_, meetingId: string) => {
    const meeting = repo.getMeeting(meetingId);
    if (!meeting?.transcriptText) throw new Error('No transcript');
    await apiService.pushTranscript(meetingId, meeting.transcriptText, meeting.language ?? 'pt');
    const result = await apiService.chatWithMeeting(
      meetingId,
      'Identify all people mentioned or participating in this meeting. Return ONLY a JSON array: [{"name": "...", "role": "participant" or "mentioned", "confidence": 0.0-1.0}]. No other text.',
    );
    let content = result.answer.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) content = jsonMatch[0];
    return JSON.parse(content);
  });

  // ── People → Meetings + Tags ──
  ipcMain.handle('db:people:meetings', (_, personId: string) => repo.listMeetingsForPerson(personId));
  ipcMain.handle('db:tags:list-all', () => repo.listAllTags());

  // ── Database: Action Items ──
  ipcMain.handle('db:action-items:list', (_, meetingId: string) => repo.listActionItems(meetingId));
  ipcMain.handle('db:action-items:list-open-series', (_, seriesId: string) => repo.listOpenActionItemsForSeries(seriesId));
  ipcMain.handle('db:action-items:upsert', (_, item) => repo.upsertActionItem(item));
  ipcMain.handle('db:action-items:toggle', (_, id: string, resolvedInMeetingId: string) => repo.toggleActionItemStatus(id, resolvedInMeetingId));
  ipcMain.handle('db:action-items:delete', (_, id: string) => repo.deleteActionItem(id));
  ipcMain.handle('db:action-items:get-series', (_, meetingId: string) => repo.getSeriesIdForMeeting(meetingId));

  // ── AI: Extract action items ──
  ipcMain.handle('ollama:extract-action-items', async (_, meetingId: string) => {
    const meeting = repo.getMeeting(meetingId);
    if (!meeting?.transcriptText) throw new Error('No transcript');
    const aiConfig = store.get('aiConfig') as any;
    const model = aiConfig?.extraction?.model ?? 'qwen3:14b';
    const people = repo.listPeople();
    const meetingPeople = repo.listMeetingPeople(meetingId);
    const participantNames = meetingPeople
      .map(mp => people.find(p => p.id === mp.personId))
      .filter(Boolean)
      .map(p => p!.displayName);
    const result = await ollamaService.generateSummary({
      model,
      systemPrompt: 'You are a meeting assistant that extracts action items from meeting transcripts. Extract ONLY concrete tasks, to-dos, and commitments. Return ONLY a JSON array, no other text. Always respond in the same language as the transcript.',
      userPrompt: buildActionItemsPrompt(meeting.transcriptText, participantNames),
      maxTokens: 2000,
      temperature: 0.2,
      think: false,
    });
    let content = result.content.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) content = jsonMatch[0];
    const extracted = JSON.parse(content) as Array<{ content: string; assignee: string | null; dueDate: string | null }>;
    const seriesId = repo.getSeriesIdForMeeting(meetingId);
    return repo.insertActionItemsBatch(meetingId, seriesId, extracted, people);
  });

  ipcMain.handle('api:extract-action-items', async (_, meetingId: string) => {
    const meeting = repo.getMeeting(meetingId);
    if (!meeting?.transcriptText) throw new Error('No transcript');
    const people = repo.listPeople();
    const meetingPeople = repo.listMeetingPeople(meetingId);
    const participantNames = meetingPeople
      .map(mp => people.find(p => p.id === mp.personId))
      .filter(Boolean)
      .map(p => p!.displayName);
    await apiService.pushTranscript(meetingId, meeting.transcriptText, meeting.language ?? 'pt');
    const result = await apiService.chatWithMeeting(
      meetingId,
      buildActionItemsPrompt(meeting.transcriptText.substring(0, 500), participantNames),
    );
    let content = result.answer.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) content = jsonMatch[0];
    const extracted = JSON.parse(content) as Array<{ content: string; assignee: string | null; dueDate: string | null }>;
    const seriesId = repo.getSeriesIdForMeeting(meetingId);
    return repo.insertActionItemsBatch(meetingId, seriesId, extracted, people);
  });

  // ── Sync: Pull ──
  ipcMain.handle('sync:pull-templates', () => syncService.pullTemplates());
  ipcMain.handle('sync:pull-summary', (_, meetingId: string) => syncService.pullSummary(meetingId));

  // ── Sync ──
  ipcMain.handle('db:sync:count', () => repo.syncQueueCount());
  ipcMain.handle('db:sync:trigger', () => syncService.drain());
}

// ─── Custom protocol for serving local audio files ───────────
// Must be registered before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'dd-file',
    privileges: { secure: true, supportFetchAPI: true, stream: true, bypassCSP: true },
  },
]);

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

    // Serve local files via dd-file:// protocol (audio playback from renderer)
    // Supports Range requests for audio seeking
    protocol.handle('dd-file', (request) => {
      try {
        const filePath = decodeURIComponent(new URL(request.url).pathname);
        if (!existsSync(filePath)) {
          return new Response('File not found', { status: 404 });
        }
        const stat = statSync(filePath);
        const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
        const mimeMap: Record<string, string> = {
          webm: 'audio/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4',
          wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg',
        };
        const contentType = mimeMap[ext] ?? 'application/octet-stream';

        const makeStream = (nodeStream: ReturnType<typeof createReadStream>) => {
          let closed = false;
          return new ReadableStream({
            start(controller) {
              nodeStream.on('data', (chunk) => {
                if (closed) return;
                controller.enqueue(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
              });
              nodeStream.on('end', () => { if (!closed) { closed = true; controller.close(); } });
              nodeStream.on('error', (err) => { if (!closed) { closed = true; controller.error(err); } });
            },
            cancel() { closed = true; nodeStream.destroy(); },
          });
        };

        const rangeHeader = request.headers.get('Range');
        if (rangeHeader) {
          const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
          if (match) {
            const start = parseInt(match[1]);
            const end = match[2] ? parseInt(match[2]) : stat.size - 1;
            return new Response(makeStream(createReadStream(filePath, { start, end })), {
              status: 206,
              headers: {
                'Content-Type': contentType,
                'Content-Length': String(end - start + 1),
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
              },
            });
          }
        }

        // Full file response with Accept-Ranges header to enable seeking
        return new Response(makeStream(createReadStream(filePath)), {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(stat.size),
            'Accept-Ranges': 'bytes',
          },
        });
      } catch (err) {
        console.error('[dd-file] protocol error:', err);
        return new Response('Internal error', { status: 500 });
      }
    });

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
