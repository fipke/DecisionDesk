import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';

import { loadMeetingDetails, requestTranscription, syncRecordingWithBackend } from '../services/meetingService';
import {
  enqueueUploadOperation,
  getMeeting,
  initializeDatabase,
  listMeetings,
  listPendingOperations,
  patchMeeting,
  removeOperation,
  upsertMeeting
} from '../storage/database';
import { Meeting } from '../types';

interface MeetingContextValue {
  meetings: Meeting[];
  loading: boolean;
  recordAndQueue: (fileUri: string) => Promise<string>;
  refreshMeeting: (id: string) => Promise<void>;
  syncPendingOperations: () => Promise<void>;
  transcribeMeeting: (id: string) => Promise<void>;
}

const MeetingContext = createContext<MeetingContextValue | undefined>(undefined);

async function ensureRecordingLibrary() {
  const recordingsDir = `${FileSystem.documentDirectory}recordings`;
  const info = await FileSystem.getInfoAsync(recordingsDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(recordingsDir, { intermediates: true });
  }
  return recordingsDir;
}

export function MeetingProvider({ children }: { children: ReactNode }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const loadFromDatabase = useCallback(async () => {
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
    const targetUri = `${recordingsDir}/${id}.m4a`;
    await FileSystem.copyAsync({ from: fileUri, to: targetUri });

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
        minutes: details.minutes
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

    for (const operation of operations) {
      const meeting = await getMeeting(operation.meetingId);
      if (!meeting) {
        if (operation.id) {
          await removeOperation(operation.id);
        }
        continue;
      }

      try {
        const syncResult = await syncRecordingWithBackend(meeting);
        await patchMeeting(meeting.id, {
          remoteId: syncResult.remoteId,
          status: syncResult.status,
          createdAt: syncResult.createdAt
        });
        if (operation.id) {
          await removeOperation(operation.id);
        }
      } catch (error) {
        // Mantém na fila para uma nova tentativa
        break;
      }
    }

    await loadFromDatabase();
  }, [loadFromDatabase]);

  const transcribeMeeting = useCallback(
    async (id: string) => {
      const meeting = await getMeeting(id);
      if (!meeting?.remoteId) {
        throw new Error('A gravação precisa ser sincronizada antes de transcrever.');
      }

      await patchMeeting(id, { status: 'PROCESSING' });
      setMeetings((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'PROCESSING' } : item))
      );

      const response = await requestTranscription(meeting.remoteId);
      await patchMeeting(id, { status: response.status });
      await refreshMeeting(id);
    },
    [refreshMeeting]
  );

  const value = useMemo(
    () => ({
      meetings,
      loading,
      recordAndQueue,
      refreshMeeting,
      syncPendingOperations,
      transcribeMeeting
    }),
    [loading, meetings, recordAndQueue, refreshMeeting, syncPendingOperations, transcribeMeeting]
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
