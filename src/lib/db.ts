import Dexie, { type Table } from 'dexie';

export interface OutboxItem {
  id?: number;
  client_op_id: string;
  seq_local: number;
  device_id: string;
  facility_id?: string;
  op_type: string;
  payload: any;
  client_time: string;
  status: 'pending' | 'in_progress' | 'failed' | 'needs_review';
  error_message?: string;
  retry_count: number;
  last_attempt?: string;
}

export interface CachedRecord {
  id: string;
  facility_id?: string;
  data: any;
  cached_at: string;
}

export interface KVRecord {
  key: string;
  value: any;
}

export class SirkulaDatabase extends Dexie {
  outbox!: Table<OutboxItem, number>;
  cache_batches!: Table<CachedRecord, string>;
  cache_shipments!: Table<CachedRecord, string>;
  cache_partners!: Table<CachedRecord, string>;
  cache_categories!: Table<CachedRecord, string>;
  kv!: Table<KVRecord, string>;

  constructor() {
    super('SirkulaOfflineDB');
    this.version(1).stores({
      outbox: '++id, client_op_id, status, seq_local, client_time',
      cache_batches: 'id, facility_id, cached_at',
      cache_shipments: 'id, facility_id, cached_at',
      cache_partners: 'id, facility_id',
      cache_categories: 'id',
      kv: 'key',
    });
  }
}

export const db = new SirkulaDatabase();
