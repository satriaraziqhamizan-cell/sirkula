import { db, OutboxItem } from './db';

// Device identifier persisted in localStorage or generated
export function getDeviceId(): string {
  let devId = localStorage.getItem('sirkula_device_id');
  if (!devId) {
    devId = 'dev_' + crypto.randomUUID();
    localStorage.setItem('sirkula_device_id', devId);
  }
  return devId;
}

// Local incremental sequence for offline ordering
export function getNextLocalSeq(): number {
  const current = Number(localStorage.getItem('sirkula_local_seq') || '0');
  const next = current + 1;
  localStorage.setItem('sirkula_local_seq', next.toString());
  return next;
}

export async function queueOperation(params: {
  op_type: string;
  facility_id?: string;
  payload: any;
  client_op_id?: string;
}): Promise<OutboxItem> {
  const item: OutboxItem = {
    client_op_id: params.client_op_id || crypto.randomUUID(),
    seq_local: getNextLocalSeq(),
    device_id: getDeviceId(),
    facility_id: params.facility_id,
    op_type: params.op_type,
    payload: params.payload,
    client_time: new Date().toISOString(),
    status: 'pending',
    retry_count: 0,
  };

  const id = await db.outbox.add(item);
  item.id = id;

  // Persist storage quota if supported
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  return item;
}

export async function getOutboxCounts() {
  const pending = await db.outbox.where('status').equals('pending').count();
  const failed = await db.outbox.where('status').equals('failed').count();
  const needsReview = await db.outbox.where('status').equals('needs_review').count();
  return { pending, failed, needsReview, total: pending + failed + needsReview };
}
