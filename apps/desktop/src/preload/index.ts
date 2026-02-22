import { contextBridge, ipcRenderer } from 'electron';

import type {
  Meeting, Folder, MeetingType, Person, MeetingPerson,
  NoteBlock, Summary, MeetingSeries, MeetingSeriesEntry,
  Template, Settings, PendingJob, AcceptedJob,
  TranscriptSegment, MeetingSpeaker, ChatResponse,
  ParticipantSuggestion, PersonMeetingRow,
  ActionItem
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
      segments?: Array<{ start: number; end: number; text: string; speaker?: string }>;
    }>;
    diarize: (audioPath: string) => Promise<{ segments: Array<{ start: number; end: number; speaker: string }> }>;
  };
  api: {
    setUrl: (url: string) => Promise<void>;
    fetchMeetings: () => Promise<Meeting[]>;
    fetchMeeting: (id: string) => Promise<any>;
    fetchTemplates: () => Promise<{ id: string; name: string; isDefault: boolean; description?: string; systemPrompt?: string; userPromptTemplate?: string; model?: string; maxTokens?: number; temperature?: number; outputFormat?: string }[]>;
    generateSummary: (meetingId: string, templateId?: string) => Promise<{ id: string; text: string; model?: string; tokensUsed?: number }>;
    generateSummaryCustom: (meetingId: string, customPrompt: string) => Promise<{ id: string; text: string; model?: string; tokensUsed?: number }>;
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
    fetchStats: () => Promise<{ totalMeetings: number; totalMinutesRecorded: number; pendingProcessing: number; thisWeekCount: number }>;
    fetchCalendar: (from: string, to: string) => Promise<{ day: string; count: number }[]>;
    generateSnippet: (meetingId: string, transcript?: string) => Promise<string>;
    extractParticipants: (meetingId: string) => Promise<ParticipantSuggestion[]>;
    extractActionItems: (meetingId: string) => Promise<ActionItem[]>;
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

    // Transcript Segments
    listSegments: (meetingId: string) => Promise<TranscriptSegment[]>;
    insertSegmentsBatch: (meetingId: string, segments: Array<Omit<TranscriptSegment, 'id'> & { id?: string }>) => Promise<TranscriptSegment[]>;
    deleteSegments: (meetingId: string) => Promise<void>;
    updateSegmentSpeaker: (segmentId: string, speakerId: string, speakerLabel: string) => Promise<void>;

    // Meeting Speakers
    listMeetingSpeakers: (meetingId: string) => Promise<MeetingSpeaker[]>;
    upsertMeetingSpeaker: (speaker: Partial<MeetingSpeaker> & { meetingId: string; label: string }) => Promise<MeetingSpeaker>;
    deleteMeetingSpeaker: (id: string) => Promise<void>;
    mergeSpeakers: (meetingId: string, keepId: string, absorbId: string) => Promise<void>;

    // Meeting Series
    listMeetingSeries: () => Promise<MeetingSeries[]>;
    upsertMeetingSeries: (ms: Partial<MeetingSeries> & { name: string }) => Promise<MeetingSeries>;
    listSeriesEntries: (seriesId: string) => Promise<MeetingSeriesEntry[]>;
    addSeriesEntry: (entry: MeetingSeriesEntry) => Promise<void>;
    removeSeriesEntry: (meetingId: string, seriesId: string) => Promise<void>;
    getNextSeriesOrdinal: (seriesId: string) => Promise<number>;

    // Templates
    listTemplates: () => Promise<Template[]>;
    upsertTemplate: (t: Partial<Template> & { name: string; bodyMarkdown: string }) => Promise<Template>;
    deleteTemplate: (id: string) => Promise<void>;

    // People → meetings
    listMeetingsForPerson: (personId: string) => Promise<PersonMeetingRow[]>;

    // Tags
    listAllTags: () => Promise<string[]>;

    // Action Items
    listActionItems: (meetingId: string) => Promise<ActionItem[]>;
    listOpenActionItemsForSeries: (seriesId: string) => Promise<ActionItem[]>;
    upsertActionItem: (item: Partial<ActionItem> & { meetingId: string; content: string }) => Promise<ActionItem>;
    toggleActionItem: (id: string, resolvedInMeetingId: string) => Promise<ActionItem>;
    deleteActionItem: (id: string) => Promise<void>;
    getSeriesIdForMeeting: (meetingId: string) => Promise<string | null>;

    // Sync
    syncQueueCount: () => Promise<number>;
    triggerSync: () => Promise<{ synced: number; failed: number }>;
  };

  // ─── Connectivity ────────────────────────────────────────

  connectivity: {
    getStatus: () => Promise<{ online: boolean; backendReachable: boolean }>;
    onStatusChange: (callback: (status: { online: boolean; backendReachable: boolean }) => void) => void;
  };

  // ─── Ollama (local AI) ─────────────────────────────────

  ollama: {
    check: () => Promise<boolean>;
    models: () => Promise<string[]>;
    generateSummary: (meetingId: string, templateId?: string) =>
      Promise<{ id: string; text: string; model?: string; tokensUsed?: number }>;
    generateSummaryCustom: (meetingId: string, customPrompt: string) =>
      Promise<{ id: string; text: string; model?: string; tokensUsed?: number }>;
    generateSnippet: (meetingId: string, transcript?: string) => Promise<string>;
    extractParticipants: (meetingId: string) => Promise<ParticipantSuggestion[]>;
    extractActionItems: (meetingId: string) => Promise<ActionItem[]>;
  };

  // ─── Chat (meeting Q&A) ─────────────────────────────

  chat: {
    sendLocal: (meetingId: string, message: string) => Promise<ChatResponse>;
    sendCloud: (meetingId: string, message: string) => Promise<ChatResponse>;
  };

  // ─── Sync: Pull ───────────────────────────────────────

  sync: {
    pullTemplates: () => Promise<number>;
    pullSummary: (meetingId: string) => Promise<number>;
  };

  // ─── Events ──────────────────────────────────────────
  onActionItemsExtracted: (callback: (meetingId: string) => void) => void;

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
    transcribe: (audioPath, options) => ipcRenderer.invoke('whisper:transcribe', audioPath, options),
    diarize: (audioPath) => ipcRenderer.invoke('whisper:diarize', audioPath)
  },
  api: {
    setUrl: (url) => ipcRenderer.invoke('api:set-url', url),
    fetchMeetings: () => ipcRenderer.invoke('api:meetings:list'),
    fetchMeeting: (id) => ipcRenderer.invoke('api:meetings:get', id),
    fetchTemplates: () => ipcRenderer.invoke('api:templates:list'),
    generateSummary: (meetingId, templateId) => ipcRenderer.invoke('api:summary:generate', meetingId, templateId),
    generateSummaryCustom: (meetingId, customPrompt) => ipcRenderer.invoke('api:summary:generate-custom', meetingId, customPrompt),
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
    fetchStats: () => ipcRenderer.invoke('api:stats:get'),
    fetchCalendar: (from, to) => ipcRenderer.invoke('api:stats:calendar', from, to),
    generateSnippet: (meetingId, transcript) => ipcRenderer.invoke('api:generate-snippet', meetingId, transcript),
    extractParticipants: (meetingId) => ipcRenderer.invoke('api:extract-participants', meetingId),
    extractActionItems: (meetingId) => ipcRenderer.invoke('api:extract-action-items', meetingId),
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

    // Transcript Segments
    listSegments: (meetingId) => ipcRenderer.invoke('db:segments:list', meetingId),
    insertSegmentsBatch: (meetingId, segments) => ipcRenderer.invoke('db:segments:insert-batch', meetingId, segments),
    deleteSegments: (meetingId) => ipcRenderer.invoke('db:segments:delete', meetingId),
    updateSegmentSpeaker: (segmentId, speakerId, speakerLabel) =>
      ipcRenderer.invoke('db:segments:update-speaker', segmentId, speakerId, speakerLabel),

    // Meeting Speakers
    listMeetingSpeakers: (meetingId) => ipcRenderer.invoke('db:speakers:list', meetingId),
    upsertMeetingSpeaker: (speaker) => ipcRenderer.invoke('db:speakers:upsert', speaker),
    deleteMeetingSpeaker: (id) => ipcRenderer.invoke('db:speakers:delete', id),
    mergeSpeakers: (meetingId, keepId, absorbId) =>
      ipcRenderer.invoke('db:speakers:merge', meetingId, keepId, absorbId),

    // Series
    listMeetingSeries: () => ipcRenderer.invoke('db:series:list'),
    upsertMeetingSeries: (ms) => ipcRenderer.invoke('db:series:upsert', ms),
    listSeriesEntries: (seriesId) => ipcRenderer.invoke('db:series-entries:list', seriesId),
    addSeriesEntry: (entry) => ipcRenderer.invoke('db:series-entries:add', entry),
    removeSeriesEntry: (meetingId, seriesId) => ipcRenderer.invoke('db:series-entries:remove', meetingId, seriesId),
    getNextSeriesOrdinal: (seriesId) => ipcRenderer.invoke('db:series:next-ordinal', seriesId),

    // Templates
    listTemplates: () => ipcRenderer.invoke('db:templates:list'),
    upsertTemplate: (t) => ipcRenderer.invoke('db:templates:upsert', t),
    deleteTemplate: (id) => ipcRenderer.invoke('db:templates:delete', id),

    // People → meetings
    listMeetingsForPerson: (personId) => ipcRenderer.invoke('db:people:meetings', personId),

    // Tags
    listAllTags: () => ipcRenderer.invoke('db:tags:list-all'),

    // Action Items
    listActionItems: (meetingId) => ipcRenderer.invoke('db:action-items:list', meetingId),
    listOpenActionItemsForSeries: (seriesId) => ipcRenderer.invoke('db:action-items:list-open-series', seriesId),
    upsertActionItem: (item) => ipcRenderer.invoke('db:action-items:upsert', item),
    toggleActionItem: (id, resolvedInMeetingId) => ipcRenderer.invoke('db:action-items:toggle', id, resolvedInMeetingId),
    deleteActionItem: (id) => ipcRenderer.invoke('db:action-items:delete', id),
    getSeriesIdForMeeting: (meetingId) => ipcRenderer.invoke('db:action-items:get-series', meetingId),

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

  ollama: {
    check: () => ipcRenderer.invoke('ollama:check'),
    models: () => ipcRenderer.invoke('ollama:models'),
    generateSummary: (meetingId, templateId) =>
      ipcRenderer.invoke('ollama:generate-summary', meetingId, templateId),
    generateSummaryCustom: (meetingId, customPrompt) =>
      ipcRenderer.invoke('ollama:generate-summary-custom', meetingId, customPrompt),
    generateSnippet: (meetingId, transcript) => ipcRenderer.invoke('ollama:generate-snippet', meetingId, transcript),
    extractParticipants: (meetingId) => ipcRenderer.invoke('ollama:extract-participants', meetingId),
    extractActionItems: (meetingId) => ipcRenderer.invoke('ollama:extract-action-items', meetingId),
  },

  chat: {
    sendLocal: (meetingId, message) => ipcRenderer.invoke('ollama:chat', meetingId, message),
    sendCloud: (meetingId, message) => ipcRenderer.invoke('api:chat', meetingId, message),
  },

  sync: {
    pullTemplates: () => ipcRenderer.invoke('sync:pull-templates'),
    pullSummary: (meetingId) => ipcRenderer.invoke('sync:pull-summary', meetingId),
  },

  onActionItemsExtracted: (cb) => ipcRenderer.on('action-items:extracted', (_, meetingId) => cb(meetingId)),

  onNavigate: (cb) => ipcRenderer.on('navigate', (_, path) => cb(path))
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
