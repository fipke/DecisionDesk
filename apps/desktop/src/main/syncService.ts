// ───────────────────────────────────────────────────────────────
// Sync Service — drains the outbox (sync_queue) FIFO when the
// backend is reachable. Uses last-writer-wins via updated_at.
// ───────────────────────────────────────────────────────────────

import { ConnectivityService } from './connectivity';
import { ApiService } from './api';
import { listSyncQueue, removeSyncItem, markSyncItemFailed, upsertTemplate, upsertSummary } from './repositories';
import type { SyncQueueItem } from '../shared/types';

const MAX_RETRIES = 5;

export class SyncService {
  private draining = false;
  private connectivity: ConnectivityService;
  private api: ApiService;

  constructor(connectivity: ConnectivityService, api: ApiService) {
    this.connectivity = connectivity;
    this.api = api;

    // Auto-drain when backend becomes reachable
    this.connectivity.on('backend-reachable', () => this.drain());
  }

  /** Attempt to drain all pending sync operations. */
  async drain(): Promise<{ synced: number; failed: number }> {
    if (this.draining) return { synced: 0, failed: 0 };
    if (!this.connectivity.backendReachable) return { synced: 0, failed: 0 };

    this.draining = true;
    let synced = 0;
    let failed = 0;

    try {
      const queue = listSyncQueue();

      // Sort by dependency: parent tables first so FK constraints pass on backend
      const tablePriority: Record<string, number> = {
        people: 0, folders: 0, meeting_types: 0, templates: 0,
        meetings: 1, meeting_series: 1,
        meeting_people: 2, meeting_speakers: 2, note_blocks: 2, summaries: 2,
        action_items: 2, meeting_series_entries: 2,
        transcript_segments: 3,
      };
      queue.sort((a, b) => (tablePriority[a.tableName] ?? 5) - (tablePriority[b.tableName] ?? 5));

      for (const item of queue) {
        if (!this.connectivity.backendReachable) break;

        if (item.retries >= MAX_RETRIES) {
          // Skip permanently failed items (user can manually retry later)
          continue;
        }

        try {
          await this.pushItem(item);
          removeSyncItem(item.id);
          synced++;
        } catch (err: any) {
          markSyncItemFailed(item.id, err?.message ?? 'Unknown error');
          failed++;
        }
      }
    } finally {
      this.draining = false;
    }

    return { synced, failed };
  }

  /** Push a single sync_queue item to the backend. */
  private async pushItem(item: SyncQueueItem): Promise<void> {
    const payload = JSON.parse(item.payload);
    const table = item.tableName;
    const action = item.action;

    switch (table) {
      case 'meetings':
        if (action === 'CREATE' || action === 'UPDATE') {
          await this.api.syncMeeting(payload);
        } else if (action === 'DELETE') {
          await this.api.deleteMeeting(payload.id);
        }
        break;

      case 'folders':
        if (action === 'CREATE' || action === 'UPDATE') {
          await this.api.syncFolder(payload);
        } else if (action === 'DELETE') {
          await this.api.deleteFolder(payload.id);
        }
        break;

      case 'people':
        if (action === 'CREATE' || action === 'UPDATE') {
          await this.api.syncPerson(payload);
        } else if (action === 'DELETE') {
          await this.api.deletePerson(payload.id);
        }
        break;

      case 'note_blocks':
        if (action === 'CREATE' || action === 'UPDATE') {
          await this.api.syncNoteBlock(payload);
        } else if (action === 'DELETE') {
          await this.api.deleteNoteBlock(payload.id);
        }
        break;

      case 'summaries':
        if (action === 'CREATE' || action === 'UPDATE') {
          await this.api.syncSummary(payload);
        }
        break;

      case 'templates':
        if (action === 'CREATE' || action === 'UPDATE') {
          await this.api.syncTemplate(payload);
        } else if (action === 'DELETE') {
          await this.api.deleteTemplate(payload.id);
        }
        break;

      case 'meeting_people':
        if (action === 'CREATE') {
          await this.api.syncMeetingPerson(payload);
        } else if (action === 'DELETE') {
          await this.api.deleteMeetingPerson(payload.meetingId, payload.personId, payload.role);
        }
        break;

      case 'meeting_series':
        if (action === 'CREATE' || action === 'UPDATE') {
          await this.api.syncMeetingSeries(payload);
        }
        break;

      case 'meeting_speakers':
        if (action === 'CREATE' || action === 'UPDATE') {
          await this.api.syncMeetingSpeaker(payload);
        } else if (action === 'DELETE') {
          await this.api.deleteMeetingSpeaker(payload.meetingId, payload.id);
        }
        break;

      case 'transcript_segments':
        // Segments are synced in bulk — the payload contains { meetingId, count }
        // Individual updates (speaker reassign) are also handled
        if (action === 'CREATE') {
          await this.api.syncSegmentsBulk(payload.meetingId);
        } else if (action === 'UPDATE') {
          await this.api.syncSegmentUpdate(payload);
        }
        break;

      case 'action_items':
        // No-op for now — backend endpoints TBD
        break;

      case 'meeting_series_entries':
        // No-op for now — backend endpoints TBD
        break;

      default:
        console.warn(`[SyncService] Unknown table: ${table}`);
    }
  }

  /** Pull templates from backend into local SQLite (no re-push). */
  async pullTemplates(): Promise<number> {
    if (!this.connectivity.backendReachable) return 0;
    try {
      const remote = await this.api.fetchTemplates();
      let count = 0;
      for (const t of remote) {
        upsertTemplate({
          id: t.id,
          name: t.name,
          bodyMarkdown: '',
          description: t.description,
          systemPrompt: t.systemPrompt,
          userPromptTemplate: t.userPromptTemplate,
          outputFormat: t.outputFormat,
          model: t.model,
          maxTokens: t.maxTokens,
          temperature: t.temperature,
          isDefault: t.isDefault ?? t.default,
        }, false); // enqueueSync: false — don't re-push what we just pulled
        count++;
      }
      console.log(`[SyncService] Pulled ${count} templates from backend`);
      return count;
    } catch (err: any) {
      console.warn('[SyncService] pullTemplates failed:', err?.message);
      return 0;
    }
  }

  /** Pull summary for a specific meeting from backend into local SQLite. */
  async pullSummary(meetingId: string): Promise<number> {
    if (!this.connectivity.backendReachable) return 0;
    try {
      const remote = await this.api.fetchSummary(meetingId);
      if (!remote) return 0;
      upsertSummary({
        id: remote.id,
        meetingId,
        provider: remote.model?.includes('gpt') ? 'openai' : 'ollama',
        model: remote.model ?? 'unknown',
        style: 'cloud',
        bodyMarkdown: remote.textMd ?? remote.text ?? '',
      }, false); // don't re-push
      return 1;
    } catch (err: any) {
      console.warn(`[SyncService] pullSummary(${meetingId}) failed:`, err?.message);
      return 0;
    }
  }
}
