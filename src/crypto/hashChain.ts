import { EventLogEntry } from '../types';

export const GENESIS_HASH = '0'.repeat(64);

/**
 * Computes SHA-256 hex string using browser standard Web Crypto API.
 */
export async function sha256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Formats canonical deterministic payload as specified in SQL Lampiran A.3:
 * entity|entity_id|action|old_value|new_value|actor_id|occurred_at
 */
export function canonicalPayload(entry: {
  entity: string;
  entity_id: string;
  action: string;
  old_value?: any;
  new_value: any;
  actor_id?: string;
  occurred_at: string;
}): string {
  const oldStr = entry.old_value !== undefined && entry.old_value !== null ? JSON.stringify(entry.old_value) : '';
  const newStr = entry.new_value !== undefined && entry.new_value !== null ? JSON.stringify(entry.new_value) : '';
  const actorStr = entry.actor_id ?? '';

  return [
    entry.entity,
    entry.entity_id,
    entry.action.toLowerCase(),
    oldStr,
    newStr,
    actorStr,
    entry.occurred_at,
  ].join('|');
}

/**
 * Creates next chained event entry for a facility.
 */
export async function createChainedEvent(
  facility_id: string,
  entity: string,
  entity_id: string,
  action: string,
  new_value: any,
  old_value?: any,
  actor_id?: string,
  actor_role?: string,
  client_op_id?: string,
  lastEvent?: EventLogEntry
): Promise<EventLogEntry> {
  const nextSeq = lastEvent ? lastEvent.seq + 1 : 1;
  const prev_hash = lastEvent ? lastEvent.hash : GENESIS_HASH;
  const occurred_at = new Date().toISOString();

  const payload = canonicalPayload({
    entity,
    entity_id,
    action,
    old_value,
    new_value,
    actor_id,
    occurred_at,
  });

  const hash = await sha256(prev_hash + payload);

  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    facility_id,
    seq: nextSeq,
    entity,
    entity_id,
    action,
    old_value,
    new_value,
    actor_id,
    actor_role,
    client_op_id,
    occurred_at,
    prev_hash,
    hash,
  };
}

/**
 * Verifies mathematical integrity of an entire event log chain for a facility.
 * Mirrors Postgres verify_chain(p_facility) function.
 */
export async function verifyChain(events: EventLogEntry[]): Promise<{
  ok: boolean;
  checked: number;
  broken_at: number | null;
  details?: string;
}> {
  if (!events || events.length === 0) {
    return { ok: true, checked: 0, broken_at: null, details: 'Rantai kosong (0 event).' };
  }

  // Sort by sequence
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const expectedSeq = i + 1;

    if (entry.seq !== expectedSeq) {
      return {
        ok: false,
        checked: i,
        broken_at: entry.seq,
        details: `Nomor urut tidak berkesinambungan pada #${entry.seq} (diharapkan #${expectedSeq}).`,
      };
    }

    if (entry.prev_hash !== expectedPrevHash) {
      return {
        ok: false,
        checked: i,
        broken_at: entry.seq,
        details: `Tautan prev_hash tidak cocok pada #${entry.seq}.`,
      };
    }

    const payload = canonicalPayload({
      entity: entry.entity,
      entity_id: entry.entity_id,
      action: entry.action,
      old_value: entry.old_value,
      new_value: entry.new_value,
      actor_id: entry.actor_id,
      occurred_at: entry.occurred_at,
    });

    const calculatedHash = await sha256(entry.prev_hash + payload);
    if (calculatedHash !== entry.hash) {
      return {
        ok: false,
        checked: i,
        broken_at: entry.seq,
        details: `Hash tidak valid pada #${entry.seq}. Integritas data terputus.`,
      };
    }

    expectedPrevHash = entry.hash;
  }

  return {
    ok: true,
    checked: sorted.length,
    broken_at: null,
    details: `Seluruh ${sorted.length} entri audit trail utuh dan terverifikasi secara kriptografis (SHA-256).`,
  };
}
