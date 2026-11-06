import React, { useState } from 'react';
import { Facility, Batch, Shipment, Anomaly, PeriodReport } from '../../types';
import { Lock, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { periodMetrics, interpretGap } from '../../engine';

interface PeriodCloseModalProps {
  facility: Facility;
  batches: Batch[];
  shipments: Shipment[];
  anomalies: Anomaly[];
  onClose: () => void;
  onSubmit: (params: {
    facility_id: string;
    period_start: string;
    period_end: string;
    reported_recycled_kg: number;
  }) => Promise<PeriodReport>;
}

export const PeriodCloseModal: React.FC<PeriodCloseModalProps> = ({
  facility,
  batches,
  shipments,
  anomalies,
  onClose,
  onSubmit,
}) => {
  const [periodStart, setPeriodStart] = useState('2026-10-01');
  const [periodEnd, setPeriodEnd] = useState('2026-10-31');
  const [reportedKg, setReportedKg] = useState('1720');
  const [submitting, setSubmitting] = useState(false);

  // Filter batches & shipments
  const periodBatches = batches.filter(
    (b) =>
      b.facility_id === facility.id &&
      b.received_at >= periodStart &&
      b.received_at <= periodEnd + 'T23:59:59Z'
  );

  const periodShipments = shipments.filter(
    (s) =>
      s.facility_id === facility.id &&
      s.shipped_at >= periodStart &&
      s.shipped_at <= periodEnd + 'T23:59:59Z'
  );

  const unclosedBatches = periodBatches.filter((b) => b.status !== 'ditutup' && b.status !== 'void').length;
  const unconfirmedShipments = periodShipments.filter((s) => s.status === 'dikirim').length;
  const openAnomalies = anomalies.filter(
    (a) => a.facility_id === facility.id && a.status === 'open'
  ).length;

  const hasBlockers = unclosedBatches > 0 || unconfirmedShipments > 0 || openAnomalies > 0;

  const repKgNum = Number(reportedKg) || 0;
  const totalIn = periodBatches
    .filter((b) => b.status === 'ditutup')
    .reduce((a, b) => a + b.weight_in_total_kg, 0);

  const rr = totalIn > 0 ? repKgNum / totalIn : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        facility_id: facility.id,
        period_start: periodStart,
        period_end: periodEnd,
        reported_recycled_kg: repKgNum,
      });
      onClose();
    } catch (e) {
      console.error(e);
      alert('Gagal menutup periode.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-[#E4E7EC] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E4E7EC] flex items-center justify-between bg-[#F8FAF9]">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#0F6B4F]" />
            <div>
              <span className="text-[11px] font-bold text-[#0F6B4F] uppercase tracking-wider block">
                Penutupan Periode &amp; Pembekuan Snapshot
              </span>
              <h2 className="text-base font-bold text-[#101828]">Tutup Periode Verifikasi</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#667085] hover:bg-slate-200 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-[#344054] block mb-1">Mulai Periode</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-3 py-2 border border-[#E4E7EC] rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="font-bold text-[#344054] block mb-1">Selesai Periode</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-3 py-2 border border-[#E4E7EC] rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Reported figure input */}
          <div className="space-y-1">
            <label className="font-bold text-[#344054] block">
              Berat Daur Ulang yang Dilaporkan Pengelola (kg)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={reportedKg}
                onChange={(e) => setReportedKg(e.target.value)}
                className="w-full px-4 py-2.5 text-lg font-mono font-bold text-[#0B3D2E] border border-[#E4E7EC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]"
              />
              <span className="absolute right-4 top-2.5 text-sm font-bold text-[#667085]">kg</span>
            </div>
            <span className="text-[11px] text-[#667085]">
              Angka klaim resmi yang dilaporkan ke dinas untuk perbandingan dengan bukti fisik (RR).
            </span>
          </div>

          {/* Blockers / Warnings */}
          <div
            className={`p-3.5 rounded-xl border space-y-2 ${
              hasBlockers ? 'bg-amber-50/80 border-amber-200 text-amber-900' : 'bg-[#F0FAF5] border-[#A8E8D0] text-[#0B3D2E]'
            }`}
          >
            <span className="font-bold flex items-center gap-1.5">
              {hasBlockers ? <AlertCircle className="w-4 h-4 text-amber-700" /> : <CheckCircle2 className="w-4 h-4 text-[#0F6B4F]" />}
              <span>{hasBlockers ? 'Catatan Penghalang Periode' : 'Seluruh Prasyarat Terpenuhi'}</span>
            </span>

            <ul className="space-y-1 text-[11px] list-disc pl-5">
              <li>Batch tertutup dalam rentang: {periodBatches.filter((b) => b.status === 'ditutup').length} batch</li>
              {unclosedBatches > 0 && <li className="text-amber-800 font-semibold">{unclosedBatches} batch belum ditutup</li>}
              {unconfirmedShipments > 0 && <li className="text-amber-800 font-semibold">{unconfirmedShipments} pengiriman belum dikonfirmasi pengepul</li>}
              {openAnomalies > 0 && <li className="text-amber-800 font-semibold">{openAnomalies} anomali belum ditinjau</li>}
            </ul>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 text-xs font-bold text-white bg-[#0F6B4F] hover:bg-[#0B3D2E] rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>{submitting ? 'Membekukan Snapshot...' : 'Bekukan & Terbitkan Laporan Resmi'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
