import { fetchMeetingDetails, triggerTranscription, uploadAudio, createMeeting } from './api';
import { Meeting } from '../types';

export async function syncRecordingWithBackend(meeting: Meeting) {
  if (!meeting.recordingUri) {
    throw new Error('Gravação não encontrada.');
  }

  const remote = await createMeeting();
  const upload = await uploadAudio(remote.id, meeting.recordingUri);

  return {
    remoteId: remote.id,
    status: upload.status,
    createdAt: remote.createdAt
  };
}

export async function requestTranscription(remoteId: string) {
  return triggerTranscription(remoteId);
}

export async function loadMeetingDetails(remoteId: string) {
  const payload = await fetchMeetingDetails(remoteId);

  const transcript = payload.transcript?.text ?? null;
  const language = payload.transcript?.language ?? null;
  const whisper = payload.cost?.whisper;

  return {
    status: payload.status,
    transcriptText: transcript,
    language,
    costUsd: payload.cost?.whisper?.usd ?? payload.cost?.total?.usd ?? null,
    costBrl: payload.cost?.whisper?.brl ?? payload.cost?.total?.brl ?? null,
    minutes: whisper?.minutes ?? null
  };
}
