import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Anomaly,
  AnomalyCause,
} from '../../types';
import { useFacilities } from '../../features/facilities/useFacilities';
import { useBatches } from '../../features/batch/useBatches';
import { useShipments } from '../../features/shipment/useShipments';
import { useAnomalies } from '../../features/anomalies/useAnomalies';
import { usePeriods } from '../../features/periods/usePeriods';
import { useThresholds } from '../../features/thresholds/useThresholds';
import { useAuditLog } from '../../features/audit/useAuditLog';
import { useAuth } from '../../features/auth/useAuth';
import {
  ShieldAlert,
  Calendar,
  Lock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Users,
  Settings,
  ArrowRight,
  ExternalLink,
  Search,
  Filter,
  Check,
  Building2,
  Loader2,
  Download,
  Printer,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PeriodCloseModal } from './PeriodCloseModal';
import { interpretGap } from '../../engine';

interface PengelolaConsoleProps {
  onNavigateToPublicVerification?: (reportId: string) => void;
}

export const PengelolaConsole: React.FC<PengelolaConsoleProps> = ({
  onNavigateToPublicVerification,
}) => {
  const navigate = useNavigate();
  const {
    activeFacility,
    activeFacilityId,
    facilities,
    setActiveFacilityId,
    isFacilityLocked,
    isLoading: isLoadingFac,
  } = useFacilities();

  const { batches, isLoading: isLoadingBatches } = useBatches(activeFacilityId);
  const { shipments, isLoading: isLoadingShipments } = useShipments(activeFacilityId);
  const {
    anomalies,
    isLoading: isLoadingAnomalies,
    reviewAnomaly,
    isReviewing,
  } = useAnomalies(activeFacilityId);
  const { profile } = useAuth();
  const isManager = profile?.role === 'pengelola' || profile?.role === 'admin';
  const {
    reports: periodReports,
    isLoading: isLoadingReports,
    closePeriod,
  } = usePeriods(activeFacilityId);
  const {
    thresholdSets,
    isLoading: isLoadingThresholds,
    freezeThreshold,
    isFreezing: isFreezingThreshold,
  } = useThresholds(activeFacilityId);
  const { eventLog, isLoading: isLoadingAudit } = useAuditLog(activeFacilityId);

  const [activeTab, setActiveTab] = useState<'overview' | 'anomalies' | 'periods' | 'thresholds' | 'audit'>('overview');
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'dijelaskan' | 'dikoreksi' | 'tidak_terjelaskan'>('dijelaskan');
  const [reviewCause, setReviewCause] = useState<AnomalyCause>('kadar_air');
  const [reviewNote, setReviewNote] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [chainVerifyResult, setChainVerifyResult] = useState<{
    checked: boolean;
    ok: boolean;
    count: number;
    details?: string;
  } | null>(null);

  const openAnomalies = anomalies.filter((a) => a.status === 'open');
  const activeThreshold =
    thresholdSets.find((t) => t.status === 'beku') ||
    thresholdSets[0] || {
      id: 'th-default',
      version: 1,
      status: 'beku',
      provisional: false,
      params: { tau_neg: 0.02, tau_d: 0.05, z_cutoff: 3.5, ack_timeout_hours: 72 },
      category_stats: {
        plastik: { n: 24, median: 0.038, mad: 0.012, meanAd: 0.014 },
        kertas: { n: 18, median: 0.042, mad: 0.015, meanAd: 0.017 },
        organik: { n: 30, median: 0.065, mad: 0.021, meanAd: 0.023 },
      },
    };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnomaly || !activeFacilityId) return;

    if (reviewCause === 'lainnya' && reviewNote.trim().length < 10) {
      alert('Pilihan "lainnya" wajib menyertakan catatan penjelasan minimal 10 karakter.');
      return;
    }

    try {
      await reviewAnomaly({
        anomaly_id: selectedAnomaly.id,
        facility_id: activeFacilityId,
        status: reviewStatus,
        cause: reviewCause,
        review_note: reviewNote.trim(),
      });
      setSelectedAnomaly(null);
      setReviewNote('');
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan peninjauan anomali.');
    }
  };

  const handleRunChainVerify = async () => {
    if (!activeFacilityId) {
      alert('Pilih fasilitas terlebih dahulu.');
      return;
    }
    try {
      const { data, error } = await supabase.rpc('verify_chain', {
        p_facility: activeFacilityId,
      });

      if (error) throw error;
      const res = Array.isArray(data) ? data[0] : data;
      setChainVerifyResult({
        checked: true,
        ok: !!res?.ok,
        count: Number(res?.checked || 0),
        details: res?.ok
          ? `Rantai audit hash SHA-256 utuh terverifikasi di server PostgreSQL (${res.checked || 0} event).`
          : `Peringatan: Rantai audit terputus pada urutan #${res?.broken_at || '?'}. Integritas data tidak valid.`,
      });
    } catch (err: any) {
      setChainVerifyResult({
        checked: true,
        ok: false,
        count: 0,
        details: err.message || 'Gagal memanggil fungsi verify_chain di database.',
      });
    }
  };

  const handleOpenPublicVerify = (reportId: string) => {
    if (onNavigateToPublicVerification) {
      onNavigateToPublicVerification(reportId);
    } else {
      navigate(`/verifikasi/${reportId}`);
    }
  };

  const canFreezeThreshold =
    profile?.role === 'admin' ||
    (profile?.role === 'pengelola' &&
      !!activeThreshold?.facility_id &&
      activeThreshold.facility_id === activeFacilityId);

  const handleFreezeThreshold = async () => {
    if (!activeThreshold?.id) return;
    try {
      await freezeThreshold({
        threshold_id: activeThreshold.id,
        facility_id: activeFacilityId || undefined,
        note: `Dibekukan oleh ${profile?.role || 'pengelola'}: ${profile?.display_name || ''}`,
      });
      alert('Ambang batas berhasil dibekukan.');
    } catch (err: any) {
      alert(err.message || 'Gagal membekukan ambang batas.');
    }
  };

  const handleExportPeriodReportsCSV = () => {
    const headers = ['ID', 'Period_Start', 'Period_End', 'Status', 'Total_In_Kg', 'Verified_VRR_Kg', 'RR_Pct', 'VRR_Pct', 'Gap_Pct', 'Snapshot_Hash'];
    const rows = periodReports.map((r) => [
      r.id,
      r.period_start,
      r.period_end,
      r.status,
      r.total_in_kg,
      r.verified_kg,
      ((r.rr || 0) * 100).toFixed(1) + '%',
      ((r.vrr || 0) * 100).toFixed(1) + '%',
      ((r.gap || 0) * 100).toFixed(1) + '%',
      r.snapshot_hash || '',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].map((e) => e.join(',')).join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `SIRKULA_Laporan_Periode_${activeFacility?.name || 'TPS3R'}.csv`;
    link.click();
  };

  const isLoading =
    isLoadingFac ||
    isLoadingBatches ||
    isLoadingShipments ||
    isLoadingAnomalies ||
    isLoadingReports ||
    isLoadingThresholds;

  return (
    <div className="min-h-screen bg-[#F8FAF9] pb-24">
      {/* Top Banner */}
      <div className="bg-white border-b border-[#E4E7EC] px-4 py-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#0F6B4F] uppercase tracking-wider">
                Manajemen Pengelola Fasilitas
              </span>
              <span className="text-xs bg-[#DDF4EA] text-[#0B3D2E] font-bold px-2 py-0.5 rounded">
                KSM Mandiri
              </span>
            </div>

            {isFacilityLocked || facilities.length <= 1 ? (
              <h1 className="text-xl sm:text-2xl font-bold text-[#101828] mt-0.5">
                {activeFacility?.name || 'Memuat fasilitas...'}
              </h1>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#0F6B4F]" />
                <select
                  value={activeFacilityId || ''}
                  onChange={(e) => setActiveFacilityId(e.target.value)}
                  className="text-base sm:text-lg font-bold text-[#101828] bg-transparent border-b border-dashed border-[#0F6B4F] focus:outline-none cursor-pointer"
                >
                  {facilities.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.name} {fac.is_demo ? '(Demo)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isManager && (
              <button
                onClick={() => setShowCloseModal(true)}
                disabled={!activeFacility}
                className="px-4 py-2 bg-[#0F6B4F] hover:bg-[#0B3D2E] disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Tutup Periode Verifikasi</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E4E7EC] pb-2 overflow-x-auto">
          {[
            { id: 'overview', label: 'Ringkasan & Kinerja' },
            { id: 'anomalies', label: `Antrean Anomali (${openAnomalies.length})` },
            { id: 'periods', label: `Laporan Periode (${periodReports.length})` },
            { id: 'thresholds', label: 'Parameter & Ambang' },
            { id: 'audit', label: `Audit Log (${eventLog.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === t.id
                  ? 'bg-[#0F6B4F] text-white'
                  : 'text-[#667085] hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="p-8 text-center text-xs text-[#667085] bg-white rounded-xl border border-[#E4E7EC]">
            <Loader2 className="w-6 h-6 animate-spin text-[#0F6B4F] mx-auto mb-2" />
            <span>Memuat data pengelola...</span>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {!isLoading && activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-white rounded-xl border border-[#E4E7EC] shadow-2xs space-y-1">
                <span className="text-xs text-[#667085]">Verified Recycling Rate (VRR)</span>
                <div className="text-2xl font-extrabold text-[#0B3D2E] font-mono tabular-nums">
                  {periodReports[0]?.vrr !== undefined && periodReports[0]?.vrr !== null
                    ? (periodReports[0].vrr * 100).toFixed(1) + '%'
                    : 'Belum Ada'}
                </div>
                <span className="text-[11px] text-[#0F6B4F] block">
                  Berdasarkan konfirmasi timbangan mitra
                </span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[#E4E7EC] shadow-2xs space-y-1">
                <span className="text-xs text-[#667085]">Klaim Laporan (RR)</span>
                <div className="text-2xl font-extrabold text-slate-800 font-mono tabular-nums">
                  {periodReports[0]?.rr !== undefined && periodReports[0]?.rr !== null
                    ? (periodReports[0].rr * 100).toFixed(1) + '%'
                    : 'Belum Ada'}
                </div>
                <span className="text-[11px] text-[#667085] block">
                  Angka pelaporan pengelola
                </span>
              </div>

              <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 shadow-2xs space-y-1">
                <span className="text-xs font-bold text-amber-900">Selisih Gap (RR − VRR)</span>
                <div className="text-2xl font-extrabold text-amber-950 font-mono tabular-nums">
                  {periodReports[0]?.gap !== undefined && periodReports[0]?.gap !== null
                    ? (periodReports[0].gap >= 0 ? '+' : '') + (periodReports[0].gap * 100).toFixed(1) + '%'
                    : '-'}
                </div>
                <span className="text-[11px] text-amber-800 block">
                  {interpretGap(periodReports[0]?.gap ?? null)}
                </span>
              </div>
            </div>

            {/* Open Anomalies Alert Box */}
            {openAnomalies.length > 0 && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
                  <div>
                    <h3 className="text-xs font-bold text-amber-950">
                      Ada {openAnomalies.length} Anomali Memerlukan Peninjauan
                    </h3>
                    <p className="text-[11px] text-amber-800">
                      Anomali yang belum ditinjau akan mengecualikan batch dari perhitungan VRR ketat.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('anomalies')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Buka Antrean
                </button>
              </div>
            )}

            {/* Quick Summary of Recent Batches */}
            <div className="bg-white rounded-2xl border border-[#E4E7EC] p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#101828]">Aktivitas Penimbangan Terkini</h3>
              {batches.length === 0 ? (
                <p className="text-xs text-[#667085] py-4 text-center">Belum ada transaksi batch di fasilitas ini.</p>
              ) : (
                <div className="space-y-2">
                  {batches.slice(0, 5).map((b) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-lg bg-[#F8FAF9] border border-[#E4E7EC] flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#0B3D2E]">{b.code}</span>
                          <span className="font-semibold text-[#101828]">{b.source_name || b.source_type}</span>
                        </div>
                        <span className="text-[#667085] text-[11px]">
                          M_in: {b.weight_in_total_kg} kg · {b.status}
                        </span>
                      </div>

                      <div className="text-right font-mono">
                        {b.e_kg !== undefined ? (
                          <span className="text-[#0F6B4F] font-bold">
                            e = {b.e_kg} kg
                          </span>
                        ) : (
                          <span className="text-[#667085]">Sedang berjalan</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ANOMALY QUEUE */}
        {!isLoading && activeTab === 'anomalies' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#101828]">Antrean Peninjauan Anomali</h2>
              <p className="text-xs text-[#667085]">
                Tinjau inkonsistensi penimbangan dengan prinsip dua mata dan penjelasan objektif.
              </p>
            </div>

            {anomalies.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-[#E4E7EC] text-xs text-[#667085]">
                Tidak ada anomali yang tercatat di fasilitas ini.
              </div>
            ) : (
              <div className="space-y-3">
                {anomalies.map((anom) => {
                  const isOpen = anom.status === 'open';

                  return (
                    <div
                      key={anom.id}
                      className="p-5 bg-white rounded-xl border border-[#E4E7EC] shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                            {anom.rule_code}
                          </span>
                          <span className="text-xs font-bold text-[#101828]">
                            Severity: {anom.severity?.toUpperCase()}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded ${
                            isOpen
                              ? 'bg-amber-100 text-amber-900 font-bold'
                              : anom.status === 'dijelaskan'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {isOpen ? 'Perlu Ditinjau' : anom.status.toUpperCase()}
                        </span>
                      </div>

                      <p className="text-xs text-[#101828] font-medium leading-relaxed bg-[#F8FAF9] p-3 rounded-lg border border-[#E4E7EC]">
                        "{anom.reason_text}"
                      </p>

                      {anom.status !== 'open' && (
                        <div className="text-xs text-[#667085] space-y-0.5 pt-1 border-t border-[#E4E7EC]">
                          <div>
                            Penyebab sah: <strong className="text-[#101828]">{anom.cause}</strong>
                          </div>
                          {anom.review_note && (
                            <p className="italic text-[#344054]">
                              Catatan pengelola: "{anom.review_note}"
                            </p>
                          )}
                        </div>
                      )}

                      {isOpen && isManager && (
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => setSelectedAnomaly(anom)}
                            className="px-3.5 py-1.5 bg-[#0F6B4F] hover:bg-[#0B3D2E] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            Tinjau &amp; Pilih Penyebab
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PERIOD REPORTS */}
        {!isLoading && activeTab === 'periods' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#101828]">Laporan Periodik Resmi</h2>
                <p className="text-xs text-[#667085]">
                  Daftar laporan yang telah dibekukan snapshot kriptografisnya.
                </p>
              </div>

              {periodReports.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportPeriodReportsCSV}
                    className="px-3 py-1.5 bg-white border border-[#E4E7EC] hover:bg-slate-50 text-xs font-bold text-[#344054] rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#0F6B4F]" />
                    <span>Unduh CSV</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-white border border-[#E4E7EC] hover:bg-slate-50 text-xs font-bold text-[#344054] rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#0F6B4F]" />
                    <span>Cetak Halaman</span>
                  </button>
                </div>
              )}
            </div>

            {periodReports.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-[#E4E7EC] text-xs text-[#667085]">
                Belum ada laporan periode yang ditutup. Klik tombol "Tutup Periode Verifikasi" di atas.
              </div>
            ) : (
              <div className="space-y-3">
                {periodReports.map((r) => (
                  <div
                    key={r.id}
                    className="p-5 bg-white rounded-xl border border-[#E4E7EC] shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-[#101828]">
                          Periode: {r.period_start} s.d. {r.period_end}
                        </span>
                        <span className="text-xs text-[#667085] block font-mono">
                          Snapshot Hash: {r.snapshot_hash?.substring(0, 16)}...
                        </span>
                      </div>

                      <button
                        onClick={() => handleOpenPublicVerify(r.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#0F6B4F] bg-[#DDF4EA] hover:bg-emerald-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <span>Buka Halaman Audit Publik</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2 border-t border-[#E4E7EC]">
                      <div>
                        <span className="text-[#667085]">M_in Total:</span>
                        <span className="font-mono font-bold block">{r.total_in_kg} kg</span>
                      </div>
                      <div>
                        <span className="text-[#667085]">Laporan (RR):</span>
                        <span className="font-mono font-bold block">
                          {((r.rr ?? 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[#667085]">Terverifikasi (VRR):</span>
                        <span className="font-mono font-bold text-[#0F6B4F] block">
                          {((r.vrr ?? 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[#667085]">Selisih (Gap):</span>
                        <span className="font-mono font-bold text-amber-900 block">
                          {r.gap !== null ? (r.gap >= 0 ? '+' : '') + (r.gap * 100).toFixed(1) + '%' : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: THRESHOLDS */}
        {!isLoading && activeTab === 'thresholds' && (
          <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 space-y-6 text-xs">
            <div className="pb-4 border-b border-[#E4E7EC] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#101828]">
                  Ambang Batas Terkalibrasi ({activeThreshold.id})
                </h2>
                <p className="text-[#667085] mt-0.5">
                  Status: <strong className="text-[#0F6B4F] uppercase">{activeThreshold.status}</strong>
                  {activeThreshold.facility_id ? ' (Khusus Fasilitas)' : ' (Global Organisasi)'}
                </p>
              </div>
              {activeThreshold.status !== 'beku' && canFreezeThreshold && (
                <button
                  onClick={handleFreezeThreshold}
                  disabled={isFreezingThreshold}
                  className="px-3.5 py-1.5 bg-[#0F6B4F] hover:bg-[#0B3D2E] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isFreezingThreshold ? 'Membekukan...' : 'Bekukan Ambang Batas'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-[#F8FAF9] rounded-xl border border-[#E4E7EC]">
                <span className="text-[#667085] block">Toleransi Negatif (τ_neg)</span>
                <span className="text-base font-bold font-mono text-[#101828]">
                  {((activeThreshold.params?.tau_neg || 0.02) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="p-3 bg-[#F8FAF9] rounded-xl border border-[#E4E7EC]">
                <span className="text-[#667085] block">Toleransi 2 Pihak (τ_d)</span>
                <span className="text-base font-bold font-mono text-[#101828]">
                  {((activeThreshold.params?.tau_d || 0.05) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="p-3 bg-[#F8FAF9] rounded-xl border border-[#E4E7EC]">
                <span className="text-[#667085] block">Cutoff Skor z</span>
                <span className="text-base font-bold font-mono text-[#101828]">
                  {activeThreshold.params?.z_cutoff || 3.5}
                </span>
              </div>
              <div className="p-3 bg-[#F8FAF9] rounded-xl border border-[#E4E7EC]">
                <span className="text-[#667085] block">Batas Waktu Konfirmasi</span>
                <span className="text-base font-bold font-mono text-[#101828]">
                  {activeThreshold.params?.ack_timeout_hours || 72} jam
                </span>
              </div>
            </div>

            {activeThreshold.category_stats && Object.keys(activeThreshold.category_stats).length > 0 && (
              <div className="space-y-2">
                <span className="font-bold text-[#344054] block">Statistik Robust Per Kategori</span>
                <table className="w-full text-left text-xs border border-[#E4E7EC] rounded-lg overflow-hidden">
                  <thead className="bg-[#F8FAF9] text-[#101828] font-bold border-b border-[#E4E7EC]">
                    <tr>
                      <th className="p-2.5">Kategori</th>
                      <th className="p-2.5">Jumlah Data (n)</th>
                      <th className="p-2.5">Median Closure Error</th>
                      <th className="p-2.5">MAD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E7EC]">
                    {Object.entries(activeThreshold.category_stats).map(([k, s]: [string, any]) => (
                      <tr key={k}>
                        <td className="p-2.5 font-bold capitalize">{k}</td>
                        <td className="p-2.5 font-mono">{s?.n || 0} batch</td>
                        <td className="p-2.5 font-mono">{((s?.median || 0) * 100).toFixed(2)}%</td>
                        <td className="p-2.5 font-mono">{((s?.mad || 0) * 100).toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: AUDIT LOG */}
        {!isLoading && activeTab === 'audit' && (
          <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 space-y-6 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E4E7EC]">
              <div>
                <h2 className="text-base font-bold text-[#101828]">Audit Trail Berantai SHA-256</h2>
                <p className="text-[#667085] mt-0.5">
                  Setiap transaksi mengaitkan hash dari event sebelumnya (Append-Only).
                </p>
              </div>

              <button
                onClick={handleRunChainVerify}
                className="px-4 py-2 bg-[#0F6B4F] hover:bg-[#0B3D2E] text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Uji Keutuhan Rantai (verify_chain)</span>
              </button>
            </div>

            {chainVerifyResult && (
              <div
                className={`p-4 rounded-xl border flex items-center gap-3 ${
                  chainVerifyResult.ok
                    ? 'bg-[#F0FAF5] border-[#A8E8D0] text-[#0B3D2E]'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <CheckCircle2 className="w-5 h-5 shrink-0 text-[#0F6B4F]" />
                <div>
                  <span className="font-bold block">
                    {chainVerifyResult.ok ? 'Rantai Kriptografis Utuh' : 'Peringatan: Rantai Rusak!'}
                  </span>
                  <p className="text-[11px] mt-0.5">{chainVerifyResult.details}</p>
                </div>
              </div>
            )}

            {eventLog.length === 0 ? (
              <p className="text-center py-6 text-slate-500">Belum ada catatan log audit di fasilitas ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[#E4E7EC] rounded-lg overflow-hidden">
                  <thead className="bg-[#F8FAF9] text-[#101828] font-bold border-b border-[#E4E7EC]">
                    <tr>
                      <th className="p-2.5">Seq</th>
                      <th className="p-2.5">Entitas</th>
                      <th className="p-2.5">Aksi</th>
                      <th className="p-2.5">Hash SHA-256</th>
                      <th className="p-2.5">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E7EC] font-mono">
                    {eventLog.slice(-15).map((ev: any) => (
                      <tr key={ev.id}>
                        <td className="p-2.5 font-bold text-[#0B3D2E]">#{ev.seq || '-'}</td>
                        <td className="p-2.5">{ev.target_table || ev.entity || '-'}</td>
                        <td className="p-2.5 uppercase text-[11px] font-bold text-slate-700">{ev.event_type || ev.action}</td>
                        <td className="p-2.5 text-[11px] text-[#667085] truncate max-w-[200px]" title={ev.event_hash || ev.hash}>
                          {ev.event_hash || ev.hash || '-'}
                        </td>
                        <td className="p-2.5 text-[11px] text-[#667085]">
                          {new Date(ev.created_at || ev.occurred_at).toLocaleTimeString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Anomaly Review Modal */}
      {selectedAnomaly && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-[#E4E7EC] overflow-hidden">
            <div className="p-4 border-b border-[#E4E7EC] flex items-center justify-between bg-[#F8FAF9]">
              <h3 className="text-sm font-bold text-[#101828]">
                Tinjau Anomali {selectedAnomaly.rule_code}
              </h3>
              <button onClick={() => setSelectedAnomaly(null)} className="p-1 rounded text-[#667085] cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="p-5 space-y-4 text-xs">
              <p className="bg-[#F8FAF9] p-3 rounded-lg border border-[#E4E7EC] text-[#344054]">
                "{selectedAnomaly.reason_text}"
              </p>

              <div>
                <label className="font-bold text-[#344054] block mb-1">Status Hasil Peninjauan</label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[#E4E7EC] rounded-lg text-xs"
                >
                  <option value="dijelaskan">Dijelaskan (Sah, dihitung pd VRR peninjauan)</option>
                  <option value="dikoreksi">Telah Dikoreksi Datanya</option>
                  <option value="tidak_terjelaskan">Tidak Terjelaskan (Tetap Dikecualikan)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#344054] block mb-1">Penyebab Sah</label>
                <select
                  value={reviewCause}
                  onChange={(e) => setReviewCause(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[#E4E7EC] rounded-lg text-xs"
                >
                  <option value="kadar_air">Kadar Air Tinggi (Hujan / Penguapan)</option>
                  <option value="susut_alami">Susut Alami / Pengeringan Material</option>
                  <option value="salah_timbang">Salah Baca Timbangan Lapangan</option>
                  <option value="salah_input">Kesalahan Input Angka</option>
                  <option value="kesalahan_alat">Alat / Timbangan Error</option>
                  <option value="lainnya">Lainnya (Wajib Catatan)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#344054] block mb-1">Catatan Penjelasan (Min 10 Karakter)</label>
                <textarea
                  rows={3}
                  required={reviewCause === 'lainnya'}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Deskripsikan alasan teknis verifikasi..."
                  className="w-full px-3 py-2 border border-[#E4E7EC] rounded-lg text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={isReviewing}
                className="w-full py-2.5 bg-[#0F6B4F] hover:bg-[#0B3D2E] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {isReviewing ? 'Menyimpan...' : 'Simpan Peninjauan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Period Close Modal */}
      {showCloseModal && activeFacility && (
        <PeriodCloseModal
          facility={activeFacility}
          batches={batches}
          shipments={shipments}
          anomalies={anomalies}
          onClose={() => setShowCloseModal(false)}
          onSubmit={async (params) => {
            await closePeriod({
              facility_id: activeFacility.id,
              period_start: params.period_start,
              period_end: params.period_end,
              total_in_kg: 0,
              verified_kg: 0,
              verified_p_kg: 0,
              reported_recycled_kg: params.reported_recycled_kg,
              rr: null,
              vrr: null,
              vrr_p: null,
              gap: null,
              coverage: {},
              blockers: {},
            });
            setShowCloseModal(false);
            return {} as any;
          }}
        />
      )}
    </div>
  );
};
