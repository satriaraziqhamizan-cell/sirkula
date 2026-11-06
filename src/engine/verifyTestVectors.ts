import {
  balance,
  relDiff,
  statsOf,
  robustZ,
  evaluateBatch,
  evaluateShipment,
  periodMetrics,
} from './index';

export interface TestResult {
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export function runEngineValidationTests(): TestResult[] {
  const results: TestResult[] = [];

  // 1. Neraca Contoh (M_in 100, rec 38, org 22, res 30, DeltaS 4)
  const b1 = balance({ mIn: 100, mRec: 38, mOrg: 22, mRes: 30, deltaS: 4 });
  results.push({
    name: '1. Neraca Contoh Standar (Dokumen Induk)',
    expected: 'e = 6, e_rel = 0.06',
    actual: `e = ${b1.e}, e_rel = ${b1.eRel}`,
    passed: b1.e === 6 && Math.abs((b1.eRel ?? 0) - 0.06) < 0.0001,
  });

  // 2. Neraca Negatif (M_in 100, out total 108, DeltaS 0)
  const b2 = balance({ mIn: 100, mRec: 48, mOrg: 30, mRes: 30, deltaS: 0 });
  const f2 = evaluateBatch(
    {
      mIn: 100,
      mRec: 48,
      mOrg: 30,
      mRes: 30,
      deltaS: 0,
      dominantCategory: 'plastik',
      hasPhoto: true,
      hasOutput: true,
    },
    {
      tauNeg: 0.02,
      tauD: 0.05,
      zCutoff: 3.5,
      minN: 20,
      provisional: false,
      groupStats: {},
    }
  );
  const r2Triggered = f2.some((f) => f.rule === 'R2');
  results.push({
    name: '2. Neraca Negatif R2 (e_rel < -tau_neg)',
    expected: 'e = -8, e_rel = -0.08, R2 terdeteksi',
    actual: `e = ${b2.e}, e_rel = ${b2.eRel}, R2: ${r2Triggered ? 'YA' : 'TIDAK'}`,
    passed: b2.e === -8 && (b2.eRel ?? 0) === -0.08 && r2Triggered,
  });

  // 3. d_k Discrepancy (W = 100, W' = 94)
  const d3 = relDiff(100, 94);
  const f3a = evaluateShipment(
    {
      wSent: 100,
      wReceived: 94,
      confirmed: true,
      ageHours: 10,
      ackTimeoutHours: 72,
      hasLines: true,
    },
    {
      tauNeg: 0.02,
      tauD: 0.05,
      zCutoff: 3.5,
      minN: 20,
      provisional: false,
      groupStats: {},
    }
  );
  const f3b = evaluateShipment(
    {
      wSent: 100,
      wReceived: 94,
      confirmed: true,
      ageHours: 10,
      ackTimeoutHours: 72,
      hasLines: true,
    },
    {
      tauNeg: 0.02,
      tauD: 0.1,
      zCutoff: 3.5,
      minN: 20,
      provisional: false,
      groupStats: {},
    }
  );
  results.push({
    name: '3. Selisih Dua Pihak R3 (d_k vs tau_d)',
    expected: 'd_k = 0.06, R3 aktif pd tau_d=0.05, nonaktif pd tau_d=0.10',
    actual: `d_k = ${d3}, tau=0.05: ${f3a.some((f) => f.rule === 'R3')}, tau=0.10: ${f3b.some((f) => f.rule === 'R3')}`,
    passed:
      Math.abs((d3 ?? 0) - 0.06) < 0.001 &&
      f3a.some((f) => f.rule === 'R3') &&
      !f3b.some((f) => f.rule === 'R3'),
  });

  // 4. Robust Z-score (Iglewicz & Hoaglin)
  const x4 = [10, 12, 11, 13, 12, 50];
  const s4 = statsOf(x4);
  const z50 = robustZ(50, s4);
  const z13 = robustZ(13, s4);
  results.push({
    name: '4. Skor z Robust (x = [10, 12, 11, 13, 12, 50])',
    expected: 'med = 12, MAD = 1, z(50) ≈ 25.6, z(13) ≈ 0.67',
    actual: `med = ${s4.median}, MAD = ${s4.mad}, z(50) = ${z50.z?.toFixed(2)}, z(13) = ${z13.z?.toFixed(2)}`,
    passed:
      s4.median === 12 &&
      s4.mad === 1 &&
      Math.abs((z50.z ?? 0) - 25.631) < 0.1 &&
      Math.abs((z13.z ?? 0) - 0.6745) < 0.05,
  });

  // 5. MAD Nol Fallback (MeanAD)
  const x5 = [5, 5, 5, 5, 9];
  const s5 = statsOf(x5);
  const z9 = robustZ(9, s5);
  results.push({
    name: '5. Kasus Tepi MAD = 0 (Fallback ke MeanAD)',
    expected: 'MAD = 0, z(9) terhitung ≈ 3.99 tanpa crash (Metode MeanAD)',
    actual: `MAD = ${s5.mad}, method = ${z9.method}, z(9) = ${z9.z?.toFixed(2)}`,
    passed: s5.mad === 0 && z9.method === 'meanad' && Math.abs((z9.z ?? 0) - 3.989) < 0.1,
  });

  // 6. n Kecil (n < min_n)
  const f6 = evaluateBatch(
    {
      mIn: 100,
      mRec: 35,
      mOrg: 20,
      mRes: 35,
      deltaS: 0,
      dominantCategory: 'kaca',
      hasPhoto: true,
      hasOutput: true,
    },
    {
      tauNeg: 0.02,
      tauD: 0.05,
      zCutoff: 3.5,
      minN: 20,
      provisional: true,
      groupStats: {
        kaca: { n: 8, median: 0.03, mad: 0.01, meanAd: 0.01 },
      },
    }
  );
  results.push({
    name: '6. Ambang n Kecil (n < 20 -> R1 Dilewati)',
    expected: 'R1 tidak dijalankan karena n kelompok < min_n',
    actual: `R1 aktif: ${f6.some((f) => f.rule === 'R1') ? 'YA' : 'TIDAK'}`,
    passed: !f6.some((f) => f.rule === 'R1'),
  });

  // 7. VRR Contoh (Dokumen Induk: Total In 1000, Verified 300, Reported 450)
  const m7 = periodMetrics({
    batches: [
      { id: 'b1', mIn: 600, closed: true, r12: 'none' },
      { id: 'b2', mIn: 400, closed: true, r12: 'none' },
    ],
    shipments: [
      {
        id: 's1',
        purpose: 'daur_ulang',
        wSent: 300,
        wReceived: 300,
        confirmed: true,
        batchIds: ['b1'],
      },
    ],
    reportedRecycledKg: 450,
    tauD: 0.05,
  });
  results.push({
    name: '7. Metrik Periode (RR, VRR, Gap)',
    expected: 'RR = 0.45, VRR = 0.30, Gap = 0.15',
    actual: `RR = ${m7.rr}, VRR = ${m7.vrr}, Gap = ${m7.gap}`,
    passed:
      Math.abs((m7.rr ?? 0) - 0.45) < 0.001 &&
      Math.abs((m7.vrr ?? 0) - 0.3) < 0.001 &&
      Math.abs((m7.gap ?? 0) - 0.15) < 0.001,
  });

  // 8. Konfirmasi tanpa batch lolos (batch punya R2 open → tidak masuk V)
  const m8 = periodMetrics({
    batches: [{ id: 'b1', mIn: 1000, closed: true, r12: 'active' }],
    shipments: [
      {
        id: 's1',
        purpose: 'daur_ulang',
        wSent: 300,
        wReceived: 300,
        confirmed: true,
        batchIds: ['b1'],
      },
    ],
    reportedRecycledKg: 450,
    tauD: 0.05,
  });
  results.push({
    name: '8. Konfirmasi tanpa batch lolos (batch punya R2 open -> tidak masuk V)',
    expected: 'VRR = 0, verifiedKg = 0 (tidak masuk V)',
    actual: `VRR = ${m8.vrr}, verifiedKg = ${m8.verifiedKg}`,
    passed: m8.vrr === 0 && m8.verifiedKg === 0,
  });

  // 9. VRR dengan Peninjauan (Status 'dijelaskan')
  const m9 = periodMetrics({
    batches: [{ id: 'b1', mIn: 1000, closed: true, r12: 'explained' }],
    shipments: [
      {
        id: 's1',
        purpose: 'daur_ulang',
        wSent: 300,
        wReceived: 300,
        confirmed: true,
        batchIds: ['b1'],
      },
    ],
    reportedRecycledKg: 450,
    tauD: 0.05,
  });
  results.push({
    name: '9. Dampak Status Dijelaskan pd VRR Ketat vs VRR Peninjauan',
    expected: 'VRR Ketat = 0.0, VRR Peninjauan (VRR_p) = 0.30',
    actual: `VRR = ${m9.vrr}, VRR_p = ${m9.vrrP}`,
    passed: m9.vrr === 0 && Math.abs((m9.vrrP ?? 0) - 0.3) < 0.001,
  });

  // 10. Idempoten (jalankan dua kali, hasil identik, tidak ada anomali ganda)
  const inputBatch = {
    mIn: 100,
    mRec: 48,
    mOrg: 30,
    mRes: 30,
    deltaS: 0,
    dominantCategory: 'plastik',
    hasPhoto: true,
    hasOutput: true,
  };
  const th10 = {
    tauNeg: 0.02,
    tauD: 0.05,
    zCutoff: 3.5,
    minN: 20,
    provisional: false,
    groupStats: {},
  };
  const run1 = evaluateBatch(inputBatch, th10);
  const run2 = evaluateBatch(inputBatch, th10);
  // Deduplication check: same rule count and same flags
  const run1Json = JSON.stringify(run1);
  const run2Json = JSON.stringify(run2);
  const isIdentical = run1Json === run2Json;
  const noDuplicates = run1.length === 1 && run1[0].rule === 'R2';

  results.push({
    name: '10. Idempoten (Jalankan Dua Kali, Hasil Identik & Tanpa Anomali Ganda)',
    expected: 'run1 identik run2, flags length sama tanpa duplikasi',
    actual: `Identik: ${isIdentical ? 'YA' : 'TIDAK'}, Jumlah flag: ${run1.length}`,
    passed: isIdentical && noDuplicates,
  });

  return results;
}
