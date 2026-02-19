import { contextBridge, ipcRenderer } from 'electron';

import type {
  Meeting, Folder, MeetingType, Person, MeetingPerson,
  NoteBlock, Summary, MeetingSeries, MeetingSeriesEntry,
  Template, Settings, PendingJob, AcceptedJob
} from '../shared/types';

// ─── ElectronAPI type definition ─────────────────────────────

export interface ElectronAPI {
  settings: {
    get: () => Promise<Settings>;
    set: (key: string, value: unknown) => Promise<Settings>;
  };
  queue: {
    getPending: () => Promise<PendingJob[]>;
    acceptJob: (meetingId: string) => Promise<AcceptedJob>;
    processJob: (meetingId: string) => Promise<void>;
    onJobReceived: (callback: (job: PendingJob) => void) => void;
    onJobCompleted: (callback: (meetingId: string) => void) => void;
    onJobFailed: (callback: (data: { meetingId: string; error: string }) => void) => void;
  };
  whisper: {
    getStatus: () => Promise<{ available: boolean; models: string[] }>;
    transcribe: (audioPath: string, options: {
      model: string;
      language: string;
      enableDiarization: boolean;
    }) => Promise<{
      text: string;
      language: string;
      durationSeconds: number;
      processingTimeMs: number;
    }>;
  };
  api: {
    setUrl: (url: string) => Promise<void>;
    fetchMeetings: () => Promise<Meeting[]>;
    fetchMeeting: (id: string) => Promise<any>;
    fetchTemplates: () => Promise<{ id: string; name: string; isDefault: boolean; description?: string; systemPrompt?: string; userPromptTemplate?: string; model?: string; maxTokens?: number; temperature?: number; outputFormat?: string }[]>;
    generateSummary: (meetingId: string, templateId?: string) => Promise<{ id: string; text: string; model?: string; tokensUsed?: number }>;
    fetchSummary: (meetingId: string) => Promise<{ id: string; text: string } | null>;
    transcribeMeeting: (meetingId: string, options?: { provider?: string; model?: string; enableDiarization?: boolean }) => Promise<{ meetingId: string; status: string }>;
    resetMeetingStatus: (meetingId: string) => Promise<any>;
    getAudioUrl: (meetingId: string) => Promise<string>;
    downloadAudio: (meetingId: string) => Promise<string>;
    createTemplate: (payload: Record<string, unknown>) => Promise<any>;
    updateTemplate: (id: string, payload: Record<string, unknown>) => Promise<any>;
    deleteTemplate: (id: string) => Promise<void>;
    setDefaultTemplate: (id: string) => Promise<void>;
    createPerson: (payload: Record<string, unknown>) => Promise<any>;
    updatePerson: (id: string, payload: Record<string, unknown>) => Promise<any>;
    deletePerson: (id: string) => Promise<void>;
  };
  recording: {
    save: (arrayBuffer: ArrayBuffer) => Promise<string>;
    createMeeting: (filePath: string, liveNotes?: string) => Promise<Meeting>;
  };
  import: {
    openAudioFile: () => Promise<string | null>;
    uploadAudio: (filePath: string, title?: string) => Promise<{ meetingId: string; transcriptLength: number }>;
    text: (text: string, title?: string) => Promise<{ meetingId: string; transcriptLength: number }>;
  };

  // ─── Local database (offline-first) ──────────────────────

  db: {
    // Meetings
    listMeetings: () => Promise<Meeting[]>;
    listMeetingsByFolder: (folderId: string) => Promise<Meeting[]>;
    getMeeting: (id: string) => Promise<Meeting | null>;
    upsertMeeting: (meeting: Partial<Meeting> & { id?: string }) => Promise<Meeting>;
    deleteMeeting: (id: string) => Promise<void>;

    // Folders
    listFolders: () => Promise<Folder[]>;
    getFolder: (id: string) => Promise<Folder | null>;
    upsertFolder: (folder: Partial<Folder> & { name: string }) => Promise<Folder>;
    deleteFolder: (id: string) => Promise<void>;

    // Meeting Types
    listMeetingTypes: () => Promise<MeetingType[]>;
    getMeetingType: (id: string) => Promise<MeetingType | null>;
    upsertMeetingType: (mt: Partial<MeetingType> & { name: string }) => Promise<MeetingType>;

    // People
    listPeople: () => Promise<Person[]>;
    getPerson: (id: string) => Promise<Person | null>;
    upsertPerson: (p: Partial<Person> & { displayName: string }) => Promise<Person>;
    deletePerson: (id: string) => Promise<void>;

    // Meeting × People
    listMeetingPeople: (meetingId: string) => Promise<MeetingPerson[]>;
    addMeetingPerson: (mp: MeetingPerson) => Promise<void>;
    removeMeetingPerson: (meetingId: string, personId: string, role: string) => Promise<void>;

    // Note Blocks
    listNoteBlocks: (meetingId: string) => Promise<NoteBlock[]>;
    upsertNoteBlock: (nb: Partial<NoteBlock> & { meetingId: string; content: string }) => Promise<NoteBlock>;
    deleteNoteBlock: (id: string) => Promise<void>;

    // Summaries
    listSummaries: (meetingId: string) => Promise<Summary[]>;
    upsertSummary: (s: Partial<Summary> & { meetingId: string; bodyMarkdown: string }) => Promise<Summary>;

    // Meeting Series
    listMeetingSeries: () => Promise<MeetingSeries[]>;
    upsertMeetingSeries: (ms: Partial<MeetingSeries> & { name: string }) => Promise<MeetingSeries>;
    listSeriesEntries: (seriesId: string) => Promise<MeetingSeriesEntry[]>;
    addSeriesEntry: (entry: MeetingSeriesEntry) => Promise<void>;

    // Templates
    listTemplates: () => Promise<Template[]>;
    upsertTemplate: (t: Partial<Template> & { name: string; bodyMarkdown: string }) => Promise<Template>;
    deleteTemplate: (id: string) => Promise<void>;

    // Sync
    syncQueueCount: () => Promise<number>;
    triggerSync: () => Promise<{ synced: number; failed: number }>;
  };

  // ─── Connectivity ────────────────────────────────────────

  connectivity: {
    getStatus: () => Promise<{ online: boolean; backendReachable: boolean }>;
    onStatusChange: (callback: (status: { online: boolean; backendReachable: boolean }) => void) => void;
  };

  // ─── Navigation (from main process) ────────────────────
  onNavigate: (callback: (path: string) => void) => void;
}

// ─── Implementation ──────────────────────────────────────────

const electronAPI: ElectronAPI = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value)
  },
  queue: {
    getPending: () => ipcRenderer.invoke('queue:get-pending'),
    acceptJob: (meetingId) => ipcRenderer.invoke('queue:accept-job', meetingId),
    processJob: (meetingId) => ipcRenderer.invoke('queue:process-job', meetingId),
    onJobReceived: (cb) => ipcRenderer.on('queue:job-received', (_, job) => cb(job)),
    onJobCompleted: (cb) => ipcRenderer.on('queue:job-completed', (_, meetingId) => cb(meetingId)),
    onJobFailed: (cb) => ipcRenderer.on('queue:job-failed', (_, data) => cb(data))
  },
  whisper: {
    getStatus: () => ipcRenderer.invoke('whisper:get-status'),
    transcribe: (audioPath, options) => ipcRenderer.invoke('whisper:transcribe', audioPath, options)
  },
  api: {
    setUrl: (url) => ipcRenderer.invoke('api:set-url', url),
    fetchMeetings: () => ipcRenderer.invoke('api:meetings:list'),
    fetchMeeting: (id) => ipcRenderer.invoke('api:meetings:get', id),
    fetchTemplates: () => ipcRenderer.invoke('api:templates:list'),
    generateSummary: (meetingId, templateId) => ipcRenderer.invoke('api:summary:generate', meetingId, templateId),
    fetchSummary: (meetingId) => ipcRenderer.invoke('api:summary:get', meetingId),
    transcribeMeeting: (meetingId, options) => ipcRenderer.invoke('api:meetings:transcribe', meetingId, options),
    resetMeetingStatus: (meetingId) => ipcRenderer.invoke('api:meetings:reset-status', meetingId),
    getAudioUrl: (meetingId) => ipcRenderer.invoke('api:meetings:audio-url', meetingId),
    downloadAudio: (meetingId) => ipcRenderer.invoke('api:meetings:download-audio', meetingId),
    createTemplate: (payload) => ipcRenderer.invoke('api:templates:create', payload),
    updateTemplate: (id, payload) => ipcRenderer.invoke('api:templates:update', id, payload),
    deleteTemplate: (id) => ipcRenderer.invoke('api:templates:delete', id),
    setDefaultTemplate: (id) => ipcRenderer.invoke('api:templates:set-default', id),
    createPerson: (payload) => ipcRenderer.invoke('api:people:create', payload),
    updatePerson: (id, payload) => ipcRenderer.invoke('api:people:update', id, payload),
    deletePerson: (id) => ipcRenderer.invoke('api:people:delete', id),
  },
  recording: {
    save: (arrayBuffer) => ipcRenderer.invoke('recording:save', arrayBuffer),
    createMeeting: (filePath, liveNotes) => ipcRenderer.invoke('recording:create-meeting', filePath, liveNotes),
  },
  import: {
    openAudioFile: () => ipcRenderer.invoke('import:open-audio-file'),
    uploadAudio: (filePath, title) => ipcRenderer.invoke('import:upload-audio', filePath, title),
    text: (text, title) => ipcRenderer.invoke('import:text', text, title),
  },

  // ─── db namespace ────────────────────────────────────────

  db: {
    // Meetings
    listMeetings: () => ipcRenderer.invoke('db:meetings:list'),
    listMeetingsByFolder: (folderId) => ipcRenderer.invoke('db:meetings:list-by-folder', folderId),
    getMeeting: (id) => ipcRenderer.invoke('db:meetings:get', id),
    upsertMeeting: (meeting) => ipcRenderer.invoke('db:meetings:upsert', meeting),
    deleteMeeting: (id) => ipcRenderer.invoke('db:meetings:delete', id),

    // Folders
    listFolders: () => ipcRenderer.invoke('db:folders:list'),
    getFolder: (id) => ipcRenderer.invoke('db:folders:get', id),
    upsertFolder: (folder) => ipcRenderer.invoke('db:folders:upsert', folder),
    deleteFolder: (id) => ipcRenderer.invoke('db:folders:delete', id),

    // Meeting Types
    listMeetingTypes: () => ipcRenderer.invoke('db:meeting-types:list'),
    getMeetingType: (id) => ipcRenderer.invoke('db:meeting-types:get', id),
    upsertMeetingType: (mt) => ipcRenderer.invoke('db:meeting-types:upsert', mt),

    // People
    listPeople: () => ipcRenderer.invoke('db:people:list'),
    getPerson: (id) => ipcRenderer.invoke('db:people:get', id),
    upsertPerson: (p) => ipcRenderer.invoke('db:people:upsert', p),
    deletePerson: (id) => ipcRenderer.invoke('db:people:delete', id),

    // Meeting × People
    listMeetingPeople: (meetingId) => ipcRenderer.invoke('db:meeting-people:list', meetingId),
    addMeetingPerson: (mp) => ipcRenderer.invoke('db:meeting-people:add', mp),
    removeMeetingPerson: (meetingId, personId, role) =>
      ipcRenderer.invoke('db:meeting-people:remove', meetingId, personId, role),

    // Note Blocks
    listNoteBlocks: (meetingId) => ipcRenderer.invoke('db:note-blocks:list', meetingId),
    upsertNoteBlock: (nb) => ipcRenderer.invoke('db:note-blocks:upsert', nb),
    deleteNoteBlock: (id) => ipcRenderer.invoke('db:note-blocks:delete', id),

    // Summaries
    listSummaries: (meetingId) => ipcRenderer.invoke('db:summaries:list', meetingId),
    upsertSummary: (s) => ipcRenderer.invoke('db:summaries:upsert', s),

    // Series
    listMeetingSeries: () => ipcRenderer.invoke('db:series:list'),
    upsertMeetingSeries: (ms) => ipcRenderer.invoke('db:series:upsert', ms),
    listSeriesEntries: (seriesId) => ipcRenderer.invoke('db:series-entries:list', seriesId),
    addSeriesEntry: (entry) => ipcRenderer.invoke('db:series-entries:add', entry),

    // Templates
    listTemplates: () => ipcRenderer.invoke('db:templates:list'),
    upsertTemplate: (t) => ipcRenderer.invoke('db:templates:upsert', t),
    deleteTemplate: (id) => ipcRenderer.invoke('db:templates:delete', id),

    // Sync
    syncQueueCount: () => ipcRenderer.invoke('db:sync:count'),
    triggerSync: () => ipcRenderer.invoke('db:sync:trigger')
  },

  // ─── connectivity namespace ──────────────────────────────

  connectivity: {
    getStatus: () => ipcRenderer.invoke('connectivity:get-status'),
    onStatusChange: (cb) =>
      ipcRenderer.on('connectivity:status-changed', (_, status) => cb(status))
  },

  onNavigate: (cb) => ipcRenderer.on('navigate', (_, path) => cb(path))
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
