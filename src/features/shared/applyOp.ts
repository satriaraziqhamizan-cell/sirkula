import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { queueOperation, getDeviceId } from '../../lib/outbox';
import { syncManager } from '../../lib/sync';
import { db } from '../../lib/db';

export interface ApplyOpParams {
  op_type: string;
  facility_id?: string;
  payload: Record<string, any>;
  device_id?: string;
}

export interface ApplyOpResult {
  status: 'ok' | 'rejected' | 'conflict';
  code?: string;
  message?: string;
  client_op_id?: string;
  offline_queued?: boolean;
  [key: string]: any;
}

/**
 * Eksekusi mutasi data offline-first (SIRKULA Tahap C-Lite).
 * 1. Selalu ditulis LEBIH DULU ke Dexie outbox dengan UUID v4, device_id, seq_local, client_time.
 * 2. Jika online, langsung dikirimkan ke RPC apply_op di server PostgreSQL.
 * 3. Jika offline atau gangguan jaringan, antrean tetap aman di perangkat dan disinkronkan saat terhubung kembali.
 */
export async function applyOp(params: ApplyOpParams): Promise<ApplyOpResult> {
  const client_op_id = crypto.randomUUID();
  const device_id = params.device_id || getDeviceId();

  // 1. Catat ke Dexie outbox terlebih dahulu
  await queueOperation({
    op_type: params.op_type,
    facility_id: params.facility_id,
    payload: {
      ...params.payload,
      facility_id: params.facility_id,
    },
    client_op_id,
  });

  // 2. Jika kondisi sedang offline, kembalikan status sukses optimistik
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      status: 'ok',
      client_op_id,
      offline_queued: true,
      message: 'Data tersimpan di perangkat offline dan akan dikirim otomatis saat online.',
    };
  }

  if (!isSupabaseConfigured) {
    return {
      status: 'ok',
      client_op_id,
      offline_queued: true,
    };
  }

  // 3. Picu sinkronisasi antrean ke server
  await syncManager.sync();

  // Periksa apakah item ditolak server (needs_review)
  const item = await db.outbox.where('client_op_id').equals(client_op_id).first();
  if (item && item.status === 'needs_review') {
    throw new Error(item.error_message || 'Operasi ditolak oleh server.');
  }

  return { status: 'ok', client_op_id };
}
