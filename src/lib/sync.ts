import { db, OutboxItem } from './db';
import { supabase, isSupabaseConfigured } from './supabase';

type SyncListener = (status: {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  needsReviewCount: number;
}) => void;

class SyncManager {
  private isSyncing = false;
  private listeners: Set<SyncListener> = new Set();
  private timer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange());
      window.addEventListener('offline', () => this.handleNetworkChange());

      // Start periodic sync every 30 seconds
      this.timer = setInterval(() => {
        if (navigator.onLine) {
          this.sync();
        }
      }, 30_000);
    }
  }

  public subscribe(fn: SyncListener) {
    this.listeners.add(fn);
    this.notify();
    return () => {
      this.listeners.delete(fn);
    };
  }

  private async notify() {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const pendingCount = await db.outbox.where('status').equals('pending').count();
    const failedCount = await db.outbox.where('status').equals('failed').count();
    const needsReviewCount = await db.outbox.where('status').equals('needs_review').count();

    const state = {
      isOnline,
      isSyncing: this.isSyncing,
      pendingCount,
      failedCount,
      needsReviewCount,
    };

    for (const fn of this.listeners) {
      fn(state);
    }
  }

  private handleNetworkChange() {
    this.notify();
    if (navigator.onLine) {
      this.sync();
    }
  }

  public async sync(): Promise<void> {
    if (this.isSyncing || !navigator.onLine || !isSupabaseConfigured) {
      return;
    }

    this.isSyncing = true;
    this.notify();

    try {
      // Process pending items sequentially by seq_local
      const pendingItems = await db.outbox
        .where('status')
        .anyOf(['pending', 'failed'])
        .sortBy('seq_local');

      for (const item of pendingItems) {
        if (!item.id) continue;

        try {
          const { data, error } = await supabase.rpc('apply_op', {
            p_op: {
              client_op_id: item.client_op_id,
              op_type: item.op_type,
              payload: item.payload,
              device_id: item.device_id,
              client_time: item.client_time,
            },
          });

          if (error) {
            // Network or transient server error - retain for next retry
            await db.outbox.update(item.id, {
              status: 'failed',
              error_message: error.message,
              retry_count: item.retry_count + 1,
              last_attempt: new Date().toISOString(),
            });
            break; // Stop sequential execution on hard network failure
          }

          if (data?.status === 'ok') {
            // Successfully processed or idempotent duplicate -> delete from outbox
            await db.outbox.delete(item.id);
          } else if (data?.status === 'rejected') {
            // Rejected by role/validation -> mark for manual review
            await db.outbox.update(item.id, {
              status: 'needs_review',
              error_message: data.message || data.code || 'Ditolak oleh server',
              last_attempt: new Date().toISOString(),
            });
          }
        } catch (err: any) {
          await db.outbox.update(item.id, {
            status: 'failed',
            error_message: err.message,
            retry_count: item.retry_count + 1,
            last_attempt: new Date().toISOString(),
          });
          break;
        }
      }
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }
}

export const syncManager = new SyncManager();
