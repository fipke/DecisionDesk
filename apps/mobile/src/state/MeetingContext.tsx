import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { File, Directory, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

import { fetchAllMeetings } from '../services/api';
import { loadMeetingDetails, requestTranscription, syncRecordingWithBackend } from '../services/meetingService';
import {
  enqueueUploadOperation,
  getMeeting,
  getMeetingByRemoteId,
  initializeDatabase,
  listMeetings,
  listPendingOperations,
  patchMeeting,
  removeOperation,
  upsertMeeting
} from '../storage/database';
import { Meeting, TranscriptionProvider, WhisperModel } from '../types';

export interface TranscribeOptions {
  provider: TranscriptionProvider;
  model?: WhisperModel;
  enableDiarization?: boolean;
}

interface MeetingContextValue {
  meetings: Meeting[];
  loading: boolean;
  syncError: string | null;
  recordAndQueue: (fileUri: string) => Promise<string>;
  refreshMeeting: (id: string) => Promise<void>;
  syncPendingOperations: () => Promise<void>;
  transcribeMeeting: (id: string, options: TranscribeOptions) => Promise<void>;
}

const MeetingContext = createContext<MeetingContextValue | undefined>(undefined);

async function ensureRecordingLibrary() {
  const recordingsDir = new Directory(Paths.document, 'recordings');
  if (!recordingsDir.exists) {
    recordingsDir.create({ intermediates: true });
  }
  return recordingsDir;
}

export function MeetingProvider({ children }: { children: ReactNode }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadFromDatabase = useCallback(async () => {
    // 1. Try fetching from backend to merge remote meetings into local SQLite
    try {
      const remoteMeetings = await fetchAllMeetings();
      for (const rm of remoteMeetings) {
        const existing = await getMeetingByRemoteId(rm.id);
        if (!existing) {
          // New remote meeting — insert locally with remoteId = backend id
          await upsertMeeting({
            id: rm.id,
            remoteId: rm.id,
            createdAt: rm.createdAt,
            status: (rm.status as Meeting['status']) ?? 'NEW',
            recordingUri: null,
            title: rm.title ?? null,
            durationSec: rm.durationSec ?? null,
            minutes: rm.minutes ?? null,
            updatedAt: rm.updatedAt ?? null,
          });
        } else {
          // Already exists locally — patch status/title/duration if backend has newer data
          await patchMeeting(existing.id, {
            status: (rm.status as Meeting['status']) ?? existing.status,
            title: rm.title ?? existing.title,
            durationSec: rm.durationSec ?? existing.durationSec,
            minutes: rm.minutes ?? existing.minutes,
            updatedAt: rm.updatedAt ?? existing.updatedAt,
          });
        }
      }
      setSyncError(null);
    } catch {
      // Offline or backend unreachable — continue with local data only
      console.log('[MeetingContext] Backend unreachable, using local data only');
    }

    // 2. Read merged local data
    const collection = await listMeetings();
    setMeetings(collection);
  }, []);

  useEffect(() => {
    initializeDatabase()
      .then(loadFromDatabase)
      .finally(() => setLoading(false));
  }, [loadFromDatabase]);

  const recordAndQueue = useCallback(async (fileUri: string) => {
    const id = Crypto.randomUUID();
    const recordingsDir = await ensureRecordingLibrary();
    const targetFile = new File(recordingsDir, `${id}.m4a`);
    const sourceFile = new File(fileUri);
    sourceFile.copy(targetFile);
    const targetUri = targetFile.uri;

    const meeting: Meeting = {
      id,
      remoteId: null,
      createdAt: new Date().toISOString(),
      status: 'PENDING_SYNC',
      recordingUri: targetUri
    };

    await upsertMeeting(meeting);
    await enqueueUploadOperation({
      meetingId: id,
      payload: { recordingUri: targetUri },
      createdAt: Date.now()
    });

    setMeetings((prev) => [meeting, ...prev]);

    return id;
  }, []);

  const refreshMeeting = useCallback(
    async (id: string) => {
      const meeting = await getMeeting(id);
      if (!meeting?.remoteId) {
        return;
      }
      const details = await loadMeetingDetails(meeting.remoteId);
      await patchMeeting(id, {
        status: details.status,
        transcriptText: details.transcriptText,
        language: details.language,
        costUsd: details.costUsd,
        costBrl: details.costBrl,
        minutes: details.minutes,
        durationSec: details.durationSec,
      });
      await loadFromDatabase();
    },
    [loadFromDatabase]
  );

  const syncPendingOperations = useCallback(async () => {
    const operations = await listPendingOperations();
    if (!operations.length) {
      await loadFromDatabase();
      return;
    }

    console.log(`[Sync] Iniciando sincronização de ${operations.length} operação(ões)`);

    for (const operation of operations) {
      const meeting = await getMeeting(operation.meetingId);
      if (!meeting) {
        if (operation.id) {
          await removeOperation(operation.id);
        }
        continue;
      }

      try {
        console.log(`[Sync] Sincronizando reunião ${meeting.id}...`);
        const syncResult = await syncRecordingWithBackend(meeting);
        console.log(`[Sync] ✓ Reunião ${meeting.id} sincronizada com sucesso (remoteId: ${syncResult.remoteId})`);
        await patchMeeting(meeting.id, {
          remoteId: syncResult.remoteId,
          status: syncResult.status,
          createdAt: syncResult.createdAt
        });
        if (operation.id) {
          await removeOperation(operation.id);
        }
      } catch (error) {
        console.error(`[Sync] ✗ Erro ao sincronizar reunião ${meeting.id}:`, error);
        // Mantém na fila para uma nova tentativa
        break;
      }
    }

    console.log('[Sync] Sincronização finalizada');
    await loadFromDatabase();
  }, [loadFromDatabase]);

  const transcribeMeeting = useCallback(
    async (id: string, options: TranscribeOptions) => {
      const meeting = await getMeeting(id);
      if (!meeting?.remoteId) {
        throw new Error('A gravação precisa ser sincronizada antes de transcrever.');
      }

      await patchMeeting(id, { status: 'PROCESSING' });
      setMeetings((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'PROCESSING' } : item))
      );

      const response = await requestTranscription(meeting.remoteId, options);
      await patchMeeting(id, { status: response.status });
      await refreshMeeting(id);
    },
    [refreshMeeting]
  );

  const value = useMemo(
    () => ({
      meetings,
      loading,
      syncError,
      recordAndQueue,
      refreshMeeting,
      syncPendingOperations,
      transcribeMeeting
    }),
    [loading, meetings, syncError, recordAndQueue, refreshMeeting, syncPendingOperations, transcribeMeeting]
  );

  return <MeetingContext.Provider value={value}>{children}</MeetingContext.Provider>;
}

export function useMeetings() {
  const context = useContext(MeetingContext);
  if (!context) {
    throw new Error('MeetingContext não encontrado');
  }
  return context;
}

export function useMeetingList() {
  const context = useContext(MeetingContext);
  if (!context) {
    throw new Error('MeetingContext não encontrado');
  }
  const { meetings, loading } = context;
  return { meetings, loading };
}
