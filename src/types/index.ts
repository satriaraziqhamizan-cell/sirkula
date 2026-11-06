export type UserRole = 'petugas_tps3r' | 'petugas_angkut' | 'pengelola' | 'dinas' | 'admin';
export type FacilityType = 'tps3r' | 'bank_sampah' | 'pengepul' | 'pengolah' | 'tpa';
export type OutboundPurpose = 'daur_ulang' | 'organik_olah' | 'residu';
export type BatchStatus = 'masuk' | 'dipilah' | 'ditutup' | 'void';
export type BalanceStatus = 'belum_dievaluasi' | 'lolos' | 'ditandai';
export type ShipmentStatus = 'dikirim' | 'dikonfirmasi' | 'ditolak' | 'kedaluwarsa' | 'void';
export type RuleCode = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7';
export type AnomalySeverity = 'tinggi' | 'sedang' | 'rendah' | 'info';
export type AnomalyStatus = 'open' | 'dikoreksi' | 'dijelaskan' | 'tidak_terjelaskan';
export type AnomalyCause = 'salah_timbang' | 'susut_alami' | 'kadar_air' | 'salah_input' | 'kesalahan_alat' | 'lainnya';

export interface Organization {
  id: string;
  name: string;
  region_code: string;
  org_type: 'dinas' | 'kampus' | 'mandiri';
  created_at: string;
}

export interface Facility {
  id: string;
  org_id: string;
  name: string;
  public_alias?: string;
  facility_type: FacilityType;
  province: string;
  city: string;
  lat: number;
  lng: number;
  timezone: string;
  scale_resolution_kg: number;
  ack_timeout_hours: number;
  is_demo: boolean;
  is_active: boolean;
  created_at: string;
}

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  org_id?: string;
  facility_id?: string;
  is_active: boolean;
  must_change_password?: boolean;
}

export interface MaterialCategory {
  id: string;
  code: string;
  name: string;
  default_tolerance_pct: number;
  sort_order: number;
  is_active: boolean;
}

export interface Partner {
  id: string;
  facility_id: string;
  name: string;
  partner_type: 'pengepul' | 'pengolah' | 'tpa' | 'lainnya';
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface BatchItem {
  id: string;
  facility_id: string;
  batch_id: string;
  category_id: string;
  weight_sorted_kg: number;
  weight_in_est_kg?: number;
}

export interface OnsiteProcessing {
  id: string;
  facility_id: string;
  batch_id: string;
  method: 'kompos' | 'maggot' | 'lainnya';
  weight_kg: number;
}

export interface Batch {
  id: string;
  facility_id: string;
  code: string; // 6 char uppercase alphanumeric
  source_type: string;
  source_name?: string;
  weight_in_total_kg: number; // M_in
  weigh_photo_path?: string;
  received_at: string;
  status: BatchStatus;
  remaining_stock_kg?: number; // Delta S
  closed_at?: string;
  void_reason?: string;
  officer_id: string;
  officer_name?: string;
  e_kg?: number;
  e_rel?: number;
  balance_status: BalanceStatus;
  needs_review: boolean;
  version: number;
  client_created_at?: string;
  device_id?: string;
  created_at: string;
  updated_at: string;
  items?: BatchItem[];
  onsite?: OnsiteProcessing[];
}

export interface ShipmentLine {
  id: string;
  facility_id: string;
  shipment_id: string;
  batch_id: string;
  category_id: string;
  weight_kg: number;
}

export interface Shipment {
  id: string;
  facility_id: string;
  partner_id: string;
  partner_name?: string;
  purpose: OutboundPurpose;
  shipped_at: string;
  photo_path?: string;
  officer_id: string;
  officer_name?: string;
  status: ShipmentStatus;
  void_reason?: string;
  needs_review: boolean;
  token?: string;
  token_expires_at?: string;
  token_used_at?: string;
  weight_sent_kg: number; // W_k (sum of lines)
  lines?: ShipmentLine[];
  confirmation?: Confirmation;
  created_at: string;
  updated_at: string;
}

export interface Confirmation {
  id: string;
  facility_id: string;
  shipment_id: string;
  weight_received_kg: number; // W'_k
  status: 'diterima' | 'ditolak_tidak_sesuai';
  method: string;
  photo_path?: string;
  note?: string;
  confirmed_at: string;
  device_info?: {
    userAgent?: string;
    ipHash?: string;
  };
}

export interface ThresholdSet {
  id: string;
  facility_id?: string | null;
  version: number;
  status: 'draft' | 'beku' | 'pensiun';
  provisional: boolean;
  params: {
    tau_neg: number; // e.g. 0.02
    tau_d: number; // e.g. 0.05
    z_cutoff: number; // e.g. 3.5
    min_n: number; // e.g. 20
    ack_timeout_hours: number; // e.g. 72
    gap_small: number; // e.g. 0.05
    coverage_low: number; // e.g. 0.60
    r7_enabled: boolean;
  };
  category_stats: Record<string, {
    n: number;
    median: number;
    mad: number;
    meanAd: number;
  }>;
  calibration_from?: string;
  calibration_to?: string;
  frozen_at?: string;
  frozen_by?: string;
  note?: string;
  created_at: string;
}

export interface Anomaly {
  id: string;
  facility_id: string;
  batch_id?: string;
  shipment_id?: string;
  target_date?: string;
  rule_code: RuleCode;
  severity: AnomalySeverity;
  score?: number | null;
  measured: number | null;
  threshold: number | null;
  detail: Record<string, any>;
  reason_text: string;
  threshold_set_id?: string;
  provisional: boolean;
  engine_version: string;
  status: AnomalyStatus;
  cause?: AnomalyCause;
  review_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  superseded_at?: string;
  created_at: string;
}

export interface PeriodReport {
  id: string;
  facility_id: string;
  period_start: string;
  period_end: string;
  status: 'open' | 'closed';
  total_in_kg: number;
  verified_kg: number;
  verified_p_kg: number;
  reported_recycled_kg: number;
  rr: number | null;
  vrr: number | null;
  vrr_p: number | null;
  gap: number | null;
  coverage: {
    batchesClosed: number;
    totalBatches: number;
    traceablePct: number;
    shipmentsConfirmedPct: number;
    anomalyCount: number;
  };
  blockers?: {
    unconfirmedShipments: number;
    openAnomalies: number;
    unclosedBatches: number;
  };
  threshold_set_id?: string;
  engine_version: string;
  snapshot_hash: string;
  closed_by?: string;
  closed_at?: string;
}

export interface EventLogEntry {
  id: number;
  facility_id: string;
  seq: number;
  entity: string;
  entity_id: string;
  action: string;
  old_value?: any;
  new_value: any;
  actor_id?: string;
  actor_role?: string;
  client_op_id?: string;
  occurred_at: string;
  prev_hash: string;
  hash: string;
}

export interface OutboxOp {
  client_op_id: string;
  seq_local: number;
  op_type: string;
  payload: any;
  status: 'queued' | 'sending' | 'failed' | 'done' | 'conflict';
  attempts: number;
  last_error?: string;
  created_at: string;
}

export interface ReferenceWeighing {
  id: string;
  facility_id: string;
  batch_id?: string;
  facility_scale_kg: number;
  reference_scale_kg: number;
  diff_kg: number;
  rel_diff: number;
  weighed_by: string;
  weighed_at: string;
}

export interface SUSResponse {
  id: string;
  participant_code: string;
  role: string;
  answers: number[]; // 10 items, 1-5
  score: number; // 0-100
  consent: boolean;
  created_at: string;
}
