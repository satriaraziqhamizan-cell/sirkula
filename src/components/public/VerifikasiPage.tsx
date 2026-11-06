import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PeriodReport, Facility } from '../../types';
import { usePeriods } from '../../features/periods/usePeriods';
import { useFacilities } from '../../features/facilities/useFacilities';
import { ShieldCheck, ArrowLeft, CheckCircle2, Copy, FileText, Search, AlertCircle, Building2, Calendar, Loader2 } from 'lucide-react';
import { interpretGap } from '../../engine';

interface VerifikasiPageProps {
  reports?: PeriodReport[];
  facilities?: Facility[];
  selectedReportId?: string;
  onBack?: () => void;
}

export const VerifikasiPage: React.FC<VerifikasiPageProps> = (props) => {
  const { reportId: routeReportId } = useParams<{ reportId?: string }>();
  const navigate = useNavigate();

  const { reports: hookReports, isLoading: isLoadingRep } = usePeriods(undefined, true);
  const { facilities: hookFac, isLoading: isLoadingFac } = useFacilities();

  const reports = props.reports || hookReports;
  const facilities = props.facilities || hookFac;
  const onBack = props.onBack;

  const [searchId, setSearchId] = useState(routeReportId || props.selectedReportId || (reports[0]?.id ?? ''));
  const [copied, setCopied] = useState(false);

  const activeReport =
    reports.find((r) => r.id.toLowerCase() === (searchId || routeReportId || '').toLowerCase()) ||
    reports.find((r) => r.snapshot_hash?.toLowerCase() === (searchId || routeReportId || '').toLowerCase()) ||
    reports[0] ||
    null;

  const facility = activeReport ? facilities.find((f) => f.id === activeReport.facility_id) : null;

  const copyHash = () => {
    if (activeReport?.snapshot_hash) {
      navigator.clipboard.writeText(activeReport.snapshot_hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => (onBack ? onBack() : navigate('/'))}
            className="flex items-center gap-2 text-xs font-semibold text-[#0F6B4F] hover:text-[#0B3D2E] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Halaman Utama</span>
          </button>
          <span className="text-xs font-semibold text-[#667085]">
            Portal Audit Publik SIRKULA
          </span>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B3D2E] tracking-tight">
            Verifikasi Integritas Laporan Periodik
          </h1>
          <p className="text-sm text-[#667085]">
            Periksa keaslian bukti dan integritas matematis laporan neraca massa tanpa perlu akun login.
          </p>
        </div>

        {/* Search bar & Available Reports */}
        <div className="bg-white rounded-2xl border border-[#E4E7EC] p-4 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#667085]" />
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Masukkan Report ID atau Snapshot Hash..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-[#E4E7EC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]"
              />
            </div>
            <div className="flex gap-2">
              {reports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSearchId(r.id)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    activeReport?.id === r.id
                      ? 'bg-[#DDF4EA] text-[#0B3D2E] border-[#A8E8D0]'
                      : 'bg-white text-[#667085] border-[#E4E7EC] hover:bg-[#F8FAF9]'
                  }`}
                >
                  {r.id.replace('rep-', '')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Verification Card */}
        {activeReport ? (
          <div className="bg-white rounded-2xl border border-[#E4E7EC] shadow-sm overflow-hidden">
            {/* Header Status */}
            <div className="bg-[#0B3D2E] text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Snapshot Kriptografis Terverifikasi</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold">
                  {facility?.name || 'Fasilitas TPS3R'}
                </h2>
                <div className="flex items-center gap-3 text-xs text-emerald-100/90 pt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Periode: {activeReport.period_start} s.d. {activeReport.period_end}
                  </span>
                  <span>·</span>
                  <span>Versi Mesin: {activeReport.engine_version}</span>
                </div>
              </div>

              <div className="text-right sm:border-l sm:border-emerald-800 sm:pl-6">
                <span className="text-[11px] text-emerald-200 block">Status Pembekuan</span>
                <span className="text-sm font-bold text-white bg-emerald-700/80 px-2.5 py-1 rounded-md inline-block mt-1">
                  RESMI DITUTUP
                </span>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="p-6 sm:p-8 space-y-8">
              {/* The 4 Major Metric Tiles */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[#F8FAF9] border border-[#E4E7EC]">
                  <span className="text-xs text-[#667085] block">Total Sampah Masuk</span>
                  <div className="text-xl font-extrabold text-[#101828] tabular-nums mt-1">
                    {activeReport.total_in_kg.toLocaleString('id-ID')} kg
                  </div>
                  <span className="text-[11px] text-[#667085] mt-1 block">M_in ditimbang</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-[#667085] block">Klaim Pengelola (RR)</span>
                  <div className="text-xl font-extrabold text-slate-800 tabular-nums mt-1">
                    {((activeReport.rr ?? 0) * 100).toFixed(1)}%
                  </div>
                  <span className="text-[11px] text-[#667085] mt-1 block">
                    {activeReport.reported_recycled_kg.toLocaleString('id-ID')} kg dilaporkan
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#F0FAF5] border border-[#A8E8D0]">
                  <span className="text-xs font-semibold text-[#0F6B4F] block">Terverifikasi (VRR)</span>
                  <div className="text-xl font-extrabold text-[#0B3D2E] tabular-nums mt-1">
                    {((activeReport.vrr ?? 0) * 100).toFixed(1)}%
                  </div>
                  <span className="text-[11px] text-[#0F6B4F] mt-1 block">
                    {activeReport.verified_kg.toLocaleString('id-ID')} kg lolos uji
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-xs font-bold text-amber-900 block">Selisih (Gap = RR − VRR)</span>
                  <div className="text-xl font-extrabold text-amber-950 tabular-nums mt-1">
                    {activeReport.gap !== null ? (activeReport.gap > 0 ? '+' : '') + (activeReport.gap * 100).toFixed(1) + '%' : '-'}
                  </div>
                  <span className="text-[11px] text-amber-800 mt-1 block">
                    {Math.abs(activeReport.gap ?? 0) < 0.05 ? 'Konsisten (<5%)' : 'Perlu evaluasi'}
                  </span>
                </div>
              </div>

              {/* Interpretation Note */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#344054] space-y-1">
                <span className="font-bold text-[#101828] block">Pembacaan Keputusan Resmi:</span>
                <p className="leading-relaxed">
                  {interpretGap(activeReport.gap, activeReport.coverage.traceablePct)}
                </p>
              </div>

              {/* Cryptographic Proof Hash */}
              <div className="space-y-2 pt-2 border-t border-[#E4E7EC]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#344054]">
                    Snapshot Hash (SHA-256 Integritas)
                  </span>
                  <button
                    onClick={copyHash}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#0F6B4F] hover:underline cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copied ? 'Tersalin!' : 'Salin Hash'}</span>
                  </button>
                </div>
                <div className="p-3 bg-[#F8FAF9] rounded-lg border border-[#E4E7EC] font-mono text-xs text-slate-700 break-all select-all">
                  {activeReport.snapshot_hash}
                </div>
                <p className="text-[11px] text-[#667085]">
                  Hash ini dihasilkan secara deterministik dari kumpulan batch yang ditutup, log timbangan masuk, alokasi keluaran, dan konfirmasi penerima.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-white rounded-2xl border border-[#E4E7EC] text-xs text-[#667085]">
            Laporan tidak ditemukan. Silakan periksa kembali Report ID yang dimasukkan.
          </div>
        )}
      </div>
    </div>
  );
};
