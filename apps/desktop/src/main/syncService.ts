// ───────────────────────────────────────────────────────────────
// Sync Service — drains the outbox (sync_queue) FIFO when the
// backend is reachable. Uses last-writer-wins via updated_at.
// ───────────────────────────────────────────────────────────────

import { ConnectivityService } from './connectivity';
import { ApiService } from './api';
import { listSyncQueue, removeSyncItem, markSyncItemFailed } from './repositories';
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

      default:
        console.warn(`[SyncService] Unknown table: ${table}`);
    }
  }
}
