import { describe, it, expect } from 'vitest';
import {
  balance,
  relDiff,
  statsOf,
  robustZ,
  evaluateBatch,
  evaluateShipment,
  periodMetrics,
} from '../index';

describe('Vektor Uji Wajib Mesin Neraca Massa SIRKULA (Bagian 6.7)', () => {
  it('1. Neraca contoh (M_in 100; rec 38; org 22; res 30; ΔS 4 -> e=6; e_rel=0.06)', () => {
    const res = balance({ mIn: 100, mRec: 38, mOrg: 22, mRes: 30, deltaS: 4 });
    expect(res.e).toBe(6);
    expect(res.eRel).toBeCloseTo(0.06, 4);
  });

  it('2. Neraca negatif (M_in 100; keluar total 108; ΔS 0 -> e=-8; e_rel=-0.08; R2 menyala)', () => {
    const res = balance({ mIn: 100, mRec: 48, mOrg: 30, mRes: 30, deltaS: 0 });
    expect(res.e).toBe(-8);
    expect(res.eRel).toBe(-0.08);

    const flags = evaluateBatch(
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
    expect(flags.some((f) => f.rule === 'R2')).toBe(true);
  });

  it('3. d_k (W=100; W\'=94 -> d_k=0.06; R3 menyala bila τ_d=0.05, tidak bila τ_d=0.10)', () => {
    const d = relDiff(100, 94);
    expect(d).toBeCloseTo(0.06, 4);

    const f1 = evaluateShipment(
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
    const f2 = evaluateShipment(
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
    expect(f1.some((f) => f.rule === 'R3')).toBe(true);
    expect(f2.some((f) => f.rule === 'R3')).toBe(false);
  });

  it('4. z robust (x=[10,12,11,13,12,50] -> median=12; MAD=1; z(50)≈25.6; z(13)≈0.67)', () => {
    const s = statsOf([10, 12, 11, 13, 12, 50]);
    expect(s.median).toBe(12);
    expect(s.mad).toBe(1);

    const z50 = robustZ(50, s);
    const z13 = robustZ(13, s);
    expect(z50.z).toBeCloseTo(25.63, 1);
    expect(z13.z).toBeCloseTo(0.6745, 2);
  });

  it('5. MAD nol (x=[5,5,5,5,9]; uji z(9) -> MAD=0 -> pakai MeanAD; z(9)≈3.99; tidak crash)', () => {
    const s = statsOf([5, 5, 5, 5, 9]);
    expect(s.mad).toBe(0);

    const z9 = robustZ(9, s);
    expect(z9.method).toBe('meanad');
    expect(z9.z).toBeCloseTo(3.99, 1);
  });

  it('6. n kecil (8 batch di satu kelompok -> R1 tidak jalan, lencana "belum terkalibrasi")', () => {
    const flags = evaluateBatch(
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
    expect(flags.some((f) => f.rule === 'R1')).toBe(false);
  });

  it('7. VRR contoh (total masuk 1000; verified Σ W\' 300; reported 450 -> RR=0.45; VRR=0.30; Gap=0.15)', () => {
    const m = periodMetrics({
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
    expect(m.rr).toBeCloseTo(0.45, 4);
    expect(m.vrr).toBeCloseTo(0.3, 4);
    expect(m.gap).toBeCloseTo(0.15, 4);
  });

  it('8. Konfirmasi tanpa batch lolos (batch punya R2 open -> tidak masuk V)', () => {
    const m = periodMetrics({
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
    expect(m.verifiedKg).toBe(0);
    expect(m.vrr).toBe(0);
  });

  it('9. dijelaskan (R2 dijelaskan -> VRR ketat tidak berubah, VRR_p bertambah)', () => {
    const m = periodMetrics({
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
    expect(m.vrr).toBe(0);
    expect(m.vrrP).toBeCloseTo(0.3, 4);
    expect(m.verifiedKgP).toBe(300);
  });

  it('10. Idempoten (jalankan dua kali pada data sama -> hasil identik, tidak ada anomali ganda)', () => {
    const input = {
      mIn: 100,
      mRec: 48,
      mOrg: 30,
      mRes: 30,
      deltaS: 0,
      dominantCategory: 'plastik',
      hasPhoto: true,
      hasOutput: true,
    };
    const th = {
      tauNeg: 0.02,
      tauD: 0.05,
      zCutoff: 3.5,
      minN: 20,
      provisional: false,
      groupStats: {},
    };
    const run1 = evaluateBatch(input, th);
    const run2 = evaluateBatch(input, th);
    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
    expect(run1.length).toBe(1);
    expect(run1[0].rule).toBe('R2');
  });
});
