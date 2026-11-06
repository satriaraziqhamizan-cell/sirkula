export const ENGINE_VERSION = '1.0.0';

export interface BalanceInput {
  mIn: number;
  mRec: number;
  mOrg: number;
  mRes: number;
  deltaS: number;
}

export interface BalanceResult {
  e: number;
  eRel: number | null;
}

/**
 * Calculates mass balance closure error e and relative error e_rel.
 * e = M_in - (M_rec + M_org + M_res + Delta_S)
 * e_rel = e / M_in
 */
export function balance(i: BalanceInput): BalanceResult {
  const e = i.mIn - (i.mRec + i.mOrg + i.mRes + i.deltaS);
  return {
    e: Number(e.toFixed(3)),
    eRel: i.mIn > 0 ? Number((e / i.mIn).toFixed(6)) : null,
  };
}

/**
 * Relative discrepancy between sent and received weight: d_k = |W_k - W'_k| / W_k
 */
export function relDiff(wSent: number, wReceived: number): number | null {
  return wSent > 0 ? Number((Math.abs(wSent - wReceived) / wSent).toFixed(6)) : null;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mad(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

export function meanAd(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const m = median(xs);
  return xs.reduce((a, x) => a + Math.abs(x - m), 0) / xs.length;
}

export interface RobustStats {
  n: number;
  median: number;
  mad: number;
  meanAd: number;
}

export function statsOf(xs: number[]): RobustStats {
  return {
    n: xs.length,
    median: median(xs),
    mad: mad(xs),
    meanAd: meanAd(xs),
  };
}

export type ZMethod = 'mad' | 'meanad' | 'none';

/**
 * Robust z-score (Iglewicz & Hoaglin).
 * If MAD > 0: 0.6745 * (x - median) / MAD
 * If MAD === 0 && MeanAD > 0: (x - median) / (1.253314 * MeanAD)
 */
export function robustZ(x: number, s: RobustStats): { z: number | null; method: ZMethod } {
  if (s.mad > 0) {
    return { z: (0.6745 * (x - s.median)) / s.mad, method: 'mad' };
  }
  if (s.meanAd > 0) {
    return { z: (x - s.median) / (1.253314 * s.meanAd), method: 'meanad' };
  }
  return { z: null, method: 'none' };
}

export interface Thresholds {
  tauNeg: number; // e.g. 0.02
  tauD: number; // e.g. 0.05
  zCutoff: number; // e.g. 3.5
  minN: number; // e.g. 20
  provisional: boolean;
  version?: number;
  groupStats: Record<string, RobustStats>; // key: dominant category, plus 'pooled'
}

export type RuleCode = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7';

export interface Flag {
  rule: RuleCode;
  severity: 'tinggi' | 'sedang' | 'rendah' | 'info';
  measured: number | null;
  threshold: number | null;
  score?: number | null;
  z?: number | null;
  provisional: boolean;
  reasonText: string;
  detail?: Record<string, any>;
}

export function generateReasonText(
  rule: RuleCode,
  data: {
    e?: number;
    eRel?: number;
    mIn?: number;
    outTotal?: number;
    wSent?: number;
    wReceived?: number;
    dK?: number;
    tauNeg?: number;
    tauD?: number;
    z?: number;
    zCutoff?: number;
    category?: string;
    version?: number;
    provisional?: boolean;
    hours?: number;
    ackTimeout?: number;
    targetDate?: string;
    x?: number;
    med?: number;
    incompleteField?: string;
    pPct?: number;
  }
): string {
  const pct = (n?: number) => (n !== undefined ? (n * 100).toFixed(1) + '%' : '-');

  switch (rule) {
    case 'R1':
      return `Selisih penutupan batch ${pct(data.eRel)} (${data.e?.toFixed(1) ?? 0} kg dari ${data.mIn?.toFixed(1) ?? 0} kg) berada di luar rentang wajar untuk kategori dominan ${data.category ?? 'Campuran'} (skor z ${data.z?.toFixed(2) ?? '-'}, batas ${data.zCutoff ?? 3.5}). Ambang v${data.version ?? 1}, ${data.provisional ? 'sementara' : 'beku'}.`;
    case 'R2':
      return `Massa keluar dan stok (${data.outTotal?.toFixed(1) ?? 0} kg) melebihi massa masuk (${data.mIn?.toFixed(1) ?? 0} kg). Selisih ${pct(data.eRel)}, batas toleransi ${pct(data.tauNeg)}.`;
    case 'R3':
      return `Berat kirim ${data.wSent?.toFixed(1) ?? 0} kg berbeda ${pct(data.dK)} dari berat terima ${data.wReceived?.toFixed(1) ?? 0} kg. Batas toleransi selisih ${pct(data.tauD)}.`;
    case 'R4':
      return `Pengiriman belum dikonfirmasi penerima setelah ${Math.round(data.hours ?? 0)} jam (batas waktu ${data.ackTimeout ?? 72} jam).`;
    case 'R5':
      return `Total masuk ${data.targetDate ?? 'hari ini'} sebesar ${data.x?.toFixed(1) ?? 0} kg jauh dari kebiasaan 28 hari terakhir (median ${data.med?.toFixed(1) ?? 0} kg).`;
    case 'R6':
      return `Data belum lengkap: ${data.incompleteField ?? 'foto timbangan atau catatan keluaran'} belum ada.`;
    case 'R7':
      return `Proporsi berat berakhiran 0 atau 5 tinggi (${data.pPct ?? 0}%) dibanding perkiraan acak 20%. Ini indikator lemah, bukan bukti.`;
  }
}

/**
 * Evaluates a closed batch against R1, R2, and R6 rules.
 */
export function evaluateBatch(
  b: BalanceInput & {
    dominantCategory: string | null;
    hasPhoto: boolean;
    hasOutput: boolean;
  },
  th: Thresholds
): Flag[] {
  const flags: Flag[] = [];
  const { e, eRel } = balance(b);
  if (eRel === null) return flags;

  // R2: Negative closure error beyond tolerance
  if (eRel < -th.tauNeg) {
    const outTotal = b.mRec + b.mOrg + b.mRes + b.deltaS;
    flags.push({
      rule: 'R2',
      severity: 'tinggi',
      measured: eRel,
      threshold: -th.tauNeg,
      provisional: th.provisional,
      reasonText: generateReasonText('R2', {
        e,
        eRel,
        mIn: b.mIn,
        outTotal,
        tauNeg: th.tauNeg,
      }),
      detail: { e, eRel, outTotal, mIn: b.mIn, tauNeg: th.tauNeg },
    });
  }

  // R1: Robust Z outlier on closure error
  if (b.mIn >= 1) {
    const g = th.groupStats[b.dominantCategory ?? ''];
    const pooled = th.groupStats['pooled'];
    const s = g && g.n >= th.minN ? g : pooled && pooled.n >= th.minN ? pooled : null;

    if (s) {
      const { z } = robustZ(eRel, s);
      if (z !== null && Math.abs(z) > th.zCutoff) {
        flags.push({
          rule: 'R1',
          severity: 'tinggi',
          measured: eRel,
          threshold: th.zCutoff,
          score: Math.abs(z),
          z,
          provisional: th.provisional,
          reasonText: generateReasonText('R1', {
            e,
            eRel,
            mIn: b.mIn,
            category: b.dominantCategory ?? 'Campuran',
            z,
            zCutoff: th.zCutoff,
            version: th.version ?? 1,
            provisional: th.provisional,
          }),
          detail: { z, zCutoff: th.zCutoff, dominantCategory: b.dominantCategory, stats: s },
        });
      }
    }
  }

  // R6: Incomplete mandatory data
  if (!b.hasPhoto || !b.hasOutput) {
    const missing: string[] = [];
    if (!b.hasPhoto) missing.push('foto timbangan');
    if (!b.hasOutput) missing.push('catatan keluaran/pemilahan');
    flags.push({
      rule: 'R6',
      severity: 'sedang',
      measured: null,
      threshold: null,
      provisional: false,
      reasonText: generateReasonText('R6', {
        incompleteField: missing.join(' dan '),
      }),
      detail: { missing },
    });
  }

  return flags;
}

/**
 * Evaluates a shipment against R3, R4, and R6 rules.
 */
export function evaluateShipment(
  s: {
    wSent: number;
    wReceived: number | null;
    confirmed: boolean;
    ageHours: number;
    ackTimeoutHours: number;
    hasLines: boolean;
  },
  th: Thresholds
): Flag[] {
  const flags: Flag[] = [];

  // R6: Missing lines
  if (!s.hasLines) {
    flags.push({
      rule: 'R6',
      severity: 'sedang',
      measured: null,
      threshold: null,
      provisional: false,
      reasonText: generateReasonText('R6', {
        incompleteField: 'alokasi muatan batch (shipment lines)',
      }),
      detail: { missing: ['shipment_lines'] },
    });
  }

  // R3: 2-Party discrepancy W_k vs W'_k
  if (s.confirmed && s.wReceived !== null) {
    const d = relDiff(s.wSent, s.wReceived);
    if (d !== null && d > th.tauD) {
      flags.push({
        rule: 'R3',
        severity: 'tinggi',
        measured: d,
        threshold: th.tauD,
        provisional: th.provisional,
        reasonText: generateReasonText('R3', {
          wSent: s.wSent,
          wReceived: s.wReceived,
          dK: d,
          tauD: th.tauD,
        }),
        detail: { wSent: s.wSent, wReceived: s.wReceived, dK: d, tauD: th.tauD },
      });
    }
  } else if (s.ageHours > s.ackTimeoutHours) {
    // R4: Unconfirmed after timeout
    flags.push({
      rule: 'R4',
      severity: 'sedang',
      measured: s.ageHours,
      threshold: s.ackTimeoutHours,
      provisional: false,
      reasonText: generateReasonText('R4', {
        hours: s.ageHours,
        ackTimeout: s.ackTimeoutHours,
      }),
      detail: { ageHours: s.ageHours, ackTimeoutHours: s.ackTimeoutHours },
    });
  }

  return flags;
}

export type R12State = 'none' | 'active' | 'explained';

export interface MetricBatch {
  id: string;
  mIn: number;
  closed: boolean;
  r12: R12State;
}

export interface MetricShipment {
  id: string;
  purpose: 'daur_ulang' | 'organik_olah' | 'residu';
  wSent: number;
  wReceived: number | null;
  confirmed: boolean;
  batchIds: string[];
}

/**
 * Calculates Period Metrics: Total In, Verified kg (strict), Verified kg (with review),
 * RR, VRR, VRR_p, and Gap.
 */
export function periodMetrics(a: {
  batches: MetricBatch[];
  shipments: MetricShipment[];
  reportedRecycledKg: number;
  tauD: number;
}) {
  const closed = a.batches.filter((b) => b.closed);
  const totalIn = closed.reduce((s, b) => s + b.mIn, 0);
  const byId = new Map(closed.map((b) => [b.id, b] as const));

  let verified = 0;
  let verifiedP = 0;
  let confirmedN = 0;
  let recyclingN = 0;

  for (const s of a.shipments) {
    if (s.purpose !== 'daur_ulang') continue;
    recyclingN++;
    if (!(s.confirmed && s.wReceived !== null)) continue;
    confirmedN++;

    const d = relDiff(s.wSent, s.wReceived);
    if (d === null || d > a.tauD) continue;

    const bs = s.batchIds.map((id) => byId.get(id)).filter((x): x is MetricBatch => !!x);
    if (bs.length !== s.batchIds.length) continue;

    // Strict VRR: All allocated batches have NO active R1 or R2 anomalies
    if (bs.every((b) => b.r12 === 'none')) {
      verified += s.wReceived;
    }
    // VRR with review: Batches with explained anomalies are counted
    if (bs.every((b) => b.r12 !== 'active')) {
      verifiedP += s.wReceived;
    }
  }

  const div = (x: number) => (totalIn > 0 ? Number((x / totalIn).toFixed(6)) : null);
  const rr = div(a.reportedRecycledKg);
  const vrr = div(verified);
  const vrrP = div(verifiedP);

  return {
    totalIn,
    verifiedKg: verified,
    verifiedKgP: verifiedP,
    rr,
    vrr,
    vrrP,
    gap: rr !== null && vrr !== null ? Number((rr - vrr).toFixed(6)) : null,
    gapP: rr !== null && vrrP !== null ? Number((rr - vrrP).toFixed(6)) : null,
    coverage: {
      batches: closed.length,
      shipmentsConfirmedPct: recyclingN ? Number((confirmedN / recyclingN).toFixed(4)) : null,
    },
  };
}

/**
 * Textual explanation of Gap reading (Section 6.6)
 */
export function interpretGap(gap: number | null, coverageRatio = 1.0): string {
  if (gap === null) return 'Data belum cukup untuk menghitung Gap.';
  const prefix = coverageRatio < 0.6 ? 'Cakupan data masih rendah, hasil belum dapat dibaca sebagai gambaran utuh. ' : '';

  if (Math.abs(gap) < 0.05) {
    return prefix + 'Laporan konsisten dengan bukti pada periode ini (|Gap| < 5%).';
  }
  if (gap > 0) {
    return (
      prefix +
      `Laporan melampaui bukti yang terverifikasi (Gap +${(gap * 100).toFixed(1)}%). Ini alasan untuk pemeriksaan lanjut, bukan kesimpulan adanya pelanggaran.`
    );
  }
  return (
    prefix +
    `Fasilitas melaporkan lebih rendah dari bukti (Gap ${(gap * 100).toFixed(1)}%), biasanya karena pencatatan lama yang tidak lengkap.`
  );
}
