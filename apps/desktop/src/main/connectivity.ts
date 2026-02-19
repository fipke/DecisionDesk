// ───────────────────────────────────────────────────────────────
// Connectivity monitor — detects online/offline state
// Fires events that the sync service listens to.
// ───────────────────────────────────────────────────────────────

import { EventEmitter } from 'events';
import { net } from 'electron';

export class ConnectivityService extends EventEmitter {
  private _online = false;
  private _backendReachable = false;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private backendUrl: string;

  constructor(backendUrl: string) {
    super();
    this.backendUrl = backendUrl;
    this._online = net.isOnline();
  }

  get online(): boolean {
    return this._online;
  }

  get backendReachable(): boolean {
    return this._backendReachable;
  }

  /** Start periodic reachability checks. */
  start(intervalMs = 15_000): void {
    // Listen to Chromium's online/offline events
    this.check(); // immediate
    this.checkInterval = setInterval(() => this.check(), intervalMs);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  setBackendUrl(url: string): void {
    this.backendUrl = url;
  }

  async check(): Promise<void> {
    const wasOnline = this._online;
    const wasReachable = this._backendReachable;

    this._online = net.isOnline();

    if (this._online) {
      try {
        const response = await net.fetch(`${this.backendUrl}/api/v1/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5_000)
        } as any);
        this._backendReachable = response.ok;
      } catch {
        this._backendReachable = false;
      }
    } else {
      this._backendReachable = false;
    }

    // Emit events on state change
    if (!wasOnline && this._online) {
      this.emit('online');
    }
    if (wasOnline && !this._online) {
      this.emit('offline');
    }
    if (!wasReachable && this._backendReachable) {
      this.emit('backend-reachable');
    }
    if (wasReachable && !this._backendReachable) {
      this.emit('backend-unreachable');
    }

    // Always emit status for the renderer
    this.emit('status', {
      online: this._online,
      backendReachable: this._backendReachable
    });
  }
}
