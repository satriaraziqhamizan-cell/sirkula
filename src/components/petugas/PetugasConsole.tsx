import React, { useState } from 'react';
import { Batch } from '../../types';
import { useFacilities } from '../../features/facilities/useFacilities';
import { useBatches } from '../../features/batch/useBatches';
import { useShipments } from '../../features/shipment/useShipments';
import { usePartners } from '../../features/partners/usePartners';
import { useAuth } from '../../features/auth/useAuth';
import {
  Plus,
  QrCode,
  Truck,
  RotateCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Filter,
  Eye,
  FileText,
  AlertOctagon,
  Building2,
  Loader2,
  Edit3,
  Download,
} from 'lucide-react';
import { BatchCreateStepper } from './BatchCreateStepper';
import { ShipmentCreateModal } from './ShipmentCreateModal';
import { QRScanModal } from './QRScanModal';

export const PetugasConsole: React.FC = () => {
  const { profile } = useAuth();
  const {
    activeFacility,
    activeFacilityId,
    facilities,
    setActiveFacilityId,
    isFacilityLocked,
    isLoading: isLoadingFac,
  } = useFacilities();

  const {
    batches,
    isLoading: isLoadingBatches,
    createBatch,
    closeBatch,
    correctBatch,
    voidBatch,
    refetch: refetchBatches,
  } = useBatches(activeFacilityId);

  const {
    shipments,
    isLoading: isLoadingShipments,
    createShipment,
    refetch: refetchShipments,
  } = useShipments(activeFacilityId);

  const { partners } = usePartners(activeFacilityId);

  const [activeTab, setActiveTab] = useState<'batches' | 'shipments'>('batches');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

  // Correction & Void states
  const [showCorrectModal, setShowCorrectModal] = useState(false);
  const [correctWeightInput, setCorrectWeightInput] = useState('');
  const [correctReasonInput, setCorrectReasonInput] = useState('');
  const [voidReasonInput, setVoidReasonInput] = useState('');
  const [closingRemainingStock, setClosingRemainingStock] = useState('0');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Stats today
  const totalInKg = batches.reduce(
    (acc, b) => acc + (b.status !== 'void' ? Number(b.weight_in_total_kg || 0) : 0),
    0
  );
  const waitingShipments = shipments.filter((s) => s.status === 'dikirim').length;

  const handleExportBatchesCSV = () => {
    const headers = ['Kode_Batch', 'Sumber', 'Nama_Sumber', 'Berat_Masuk_Kg', 'Status', 'Stok_Sisa_Kg', 'Closure_Error_Kg', 'Closure_Error_Rel', 'Waktu_Diterima'];
    const rows = batches.map((b) => [
      b.code,
      b.source_type,
      b.source_name,
      b.weight_in_total_kg,
      b.status,
      b.remaining_stock_kg ?? 0,
      b.e_kg ?? 0,
      b.e_rel ? ((b.e_rel * 100).toFixed(1) + '%') : '0%',
      b.received_at,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].map((e) => e.join(',')).join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `SIRKULA_Batches_${activeFacility?.name || 'TPS3R'}.csv`;
    link.click();
  };

  const filteredBatches = batches.filter((b) => {
    if (filterStatus === 'all') return true;
    return b.status === filterStatus;
  });

  const handleCorrectBatch = async () => {
    if (!selectedBatch) return;
    setActionError(null);
    if (!correctReasonInput.trim()) {
      setActionError('Alasan koreksi bobot wajib diisi sesuai Aturan Wajib 0.1.');
      return;
    }
    const w = Number(correctWeightInput);
    if (isNaN(w) || w <= 0) {
      setActionError('Nilai bobot koreksi harus lebih besar dari 0 kg.');
      return;
    }

    setIsSubmittingAction(true);
    try {
      await correctBatch({
        batch_id: selectedBatch.id,
        weight_in_total_kg: w,
        reason: correctReasonInput.trim(),
      });
      setShowCorrectModal(false);
      setSelectedBatch(null);
      setCorrectReasonInput('');
      setCorrectWeightInput('');
    } catch (e: any) {
      setActionError(e.message || 'Gagal menyimpan koreksi bobot.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleVoidBatch = async () => {
    if (!selectedBatch) return;
    setActionError(null);
    if (!voidReasonInput.trim()) {
      setActionError('Alasan pembatalan (void) wajib diisi.');
      return;
    }

    setIsSubmittingAction(true);
    try {
      await voidBatch({
        batch_id: selectedBatch.id,
        void_reason: voidReasonInput.trim(),
      });
      setSelectedBatch(null);
      setVoidReasonInput('');
    } catch (e: any) {
      setActionError(e.message || 'Gagal membatalkan batch.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleCloseBatch = async () => {
    if (!selectedBatch) return;
    setActionError(null);
    const deltaS = Number(closingRemainingStock);
    if (isNaN(deltaS) || deltaS < 0) {
      setActionError('Stok sisa (ΔS) harus berupa angka non-negatif.');
      return;
    }

    const items = selectedBatch.items || [];
    const mRec = items
      .filter((i: any) => i.category_id !== '00000000-0000-0000-0000-000000000101' && i.category_id !== 'organik' && i.category_id !== 'residu')
      .reduce((sum: number, it: any) => sum + Number(it.weight_sorted_kg || 0), 0);
    const mOrg = (selectedBatch.onsite || []).reduce((sum: number, o: any) => sum + Number(o.weight_kg || 0), 0);
    const mRes = items
      .filter((i: any) => i.category_id === '00000000-0000-0000-0000-000000000106' || i.category_id === 'residu')
      .reduce((sum: number, it: any) => sum + Number(it.weight_sorted_kg || 0), 0);

    setIsSubmittingAction(true);
    try {
      await closeBatch({
        batch_id: selectedBatch.id,
        remaining_stock_kg: deltaS,
        mIn: selectedBatch.weight_in_total_kg,
        mRec,
        mOrg,
        mRes,
      });
      setSelectedBatch(null);
      setClosingRemainingStock('0');
    } catch (e: any) {
      setActionError(e.message || 'Gagal menutup batch.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const isLoading = isLoadingFac || isLoadingBatches || isLoadingShipments;

  return (
    <div className="min-h-screen bg-[#F8FAF9] pb-24">
      {/* Facility Header */}
      <div className="bg-white border-b border-[#E4E7EC] px-4 py-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[#0F6B4F] uppercase tracking-wider block">
                Konsol Petugas Lapangan
              </span>
              {!isFacilityLocked && facilities.length > 1 && (
                <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                  Mode Multi-Fasilitas
                </span>
              )}
            </div>

            {/* Facility Name or Dropdown */}
            {isFacilityLocked || facilities.length <= 1 ? (
              <h1 className="text-xl sm:text-2xl font-bold text-[#101828] tracking-tight">
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

            <span className="text-xs text-[#667085] mt-0.5 block">
              Petugas Bertugas: <strong>{profile?.display_name || 'Petugas'}</strong> ({profile?.role.replace('_', ' ')})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQrModal(true)}
              className="px-3 py-2 bg-white hover:bg-slate-50 border border-[#E4E7EC] text-[#101828] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-[#0F6B4F]" />
              <span>Pindai QR</span>
            </button>
            <button
              onClick={() => setShowBatchModal(true)}
              className="px-4 py-2 bg-[#0F6B4F] hover:bg-[#0B3D2E] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Batch Baru</span>
            </button>
            <button
              onClick={() => setShowShipmentModal(true)}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#0F6B4F] border border-emerald-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span className="hidden sm:inline">Kirim Muatan</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-white rounded-xl border border-[#E4E7EC] shadow-2xs">
            <span className="text-[11px] text-[#667085] block">Total Masuk Tercatat</span>
            <span className="text-lg font-bold font-mono text-[#101828] tabular-nums mt-0.5 block">
              {totalInKg.toLocaleString('id-ID')} kg
            </span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-[#E4E7EC] shadow-2xs">
            <span className="text-[11px] text-[#667085] block">Batch Tercatat</span>
            <span className="text-lg font-bold font-mono text-[#0B3D2E] tabular-nums mt-0.5 block">
              {batches.length} batch
            </span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-[#E4E7EC] shadow-2xs col-span-2 sm:col-span-1">
            <span className="text-[11px] text-[#667085] block">Menunggu Konfirmasi</span>
            <span className="text-lg font-bold font-mono text-amber-700 tabular-nums mt-0.5 block">
              {waitingShipments} kiriman
            </span>
          </div>
        </div>

        {/* View Segmented Tabs */}
        <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('batches')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'batches'
                  ? 'bg-[#0F6B4F] text-white'
                  : 'text-[#667085] hover:bg-slate-200'
              }`}
            >
              Daftar Batch Sampah ({batches.length})
            </button>
            <button
              onClick={() => setActiveTab('shipments')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'shipments'
                  ? 'bg-[#0F6B4F] text-white'
                  : 'text-[#667085] hover:bg-slate-200'
              }`}
            >
              Pengiriman Keluar ({shipments.length})
            </button>
          </div>

          {activeTab === 'batches' && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[#667085] hidden sm:inline">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2 py-1 text-xs border border-[#E4E7EC] rounded-lg bg-white"
              >
                <option value="all">Semua</option>
                <option value="masuk">Masuk</option>
                <option value="dipilah">Dipilah</option>
                <option value="ditutup">Ditutup</option>
                <option value="void">Void</option>
              </select>

              <button
                onClick={handleExportBatchesCSV}
                className="px-2.5 py-1 text-xs font-bold text-[#344054] bg-white hover:bg-slate-50 border border-[#E4E7EC] rounded-lg shadow-2xs flex items-center gap-1 transition-colors cursor-pointer"
                title="Unduh data batch dalam format CSV"
              >
                <Download className="w-3.5 h-3.5 text-[#0F6B4F]" />
                <span className="hidden sm:inline">Unduh CSV</span>
              </button>
            </div>
          )}
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="p-8 text-center text-xs text-[#667085] bg-white rounded-xl border border-[#E4E7EC]">
            <Loader2 className="w-6 h-6 animate-spin text-[#0F6B4F] mx-auto mb-2" />
            <span>Memuat data fasilitas dari server...</span>
          </div>
        )}

        {/* TAB 1: BATCH LIST */}
        {!isLoading && activeTab === 'batches' && (
          <div className="space-y-3">
            {filteredBatches.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-[#E4E7EC] text-[#667085] text-xs space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">Belum ada data batch untuk fasilitas ini.</p>
                <p className="text-slate-500">Klik tombol <strong>+ Batch Baru</strong> untuk mulai mencatat penimbangan masuk.</p>
              </div>
            ) : (
              filteredBatches.map((b) => {
                const isClosed = b.status === 'ditutup';
                const isVoid = b.status === 'void';

                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      setSelectedBatch(b);
                      setCorrectWeightInput(String(b.weight_in_total_kg));
                    }}
                    className="p-4 bg-white rounded-xl border border-[#E4E7EC] hover:border-[#A8E8D0] shadow-2xs transition-all flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#0B3D2E] bg-[#DDF4EA] px-2 py-0.5 rounded">
                          {b.code}
                        </span>
                        <span className="text-xs font-bold text-[#101828]">
                          {b.source_name || b.source_type}
                        </span>
                        <span className="text-xs text-[#667085]">
                          ·{' '}
                          <span
                            className={
                              isClosed
                                ? 'text-[#0F6B4F] font-semibold'
                                : isVoid
                                ? 'text-rose-600 line-through'
                                : 'text-amber-600 font-semibold'
                            }
                          >
                            {b.status.toUpperCase()}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[#667085]">
                        <span>Timbang: <strong className="text-[#101828] font-mono">{b.weight_in_total_kg} kg</strong></span>
                        <span>·</span>
                        <span>
                          {new Date(b.received_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          WIB
                        </span>
                        {isClosed && b.e_kg !== undefined && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-[#0F6B4F]">
                              e = {b.e_kg} kg ({(b.e_rel! * 100).toFixed(1)}%)
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {b.balance_status === 'ditandai' && (
                        <span className="flex items-center gap-1 text-[11px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-semibold">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Perlu Cek</span>
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-[#667085]" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: SHIPMENTS LIST */}
        {!isLoading && activeTab === 'shipments' && (
          <div className="space-y-3">
            {shipments.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-[#E4E7EC] text-[#667085] text-xs space-y-2">
                <Truck className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">Belum ada catatan pengiriman keluar.</p>
                <p className="text-slate-500">Klik tombol <strong>Kirim Muatan</strong> untuk mencatat serah terima material.</p>
              </div>
            ) : (
              shipments.map((s) => (
                <div
                  key={s.id}
                  className="p-4 bg-white rounded-xl border border-[#E4E7EC] shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {s.id.substring(0, 8).toUpperCase()}
                      </span>
                      <span className="font-bold text-xs text-[#101828]">{s.partner_name}</span>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        s.status === 'dikonfirmasi'
                          ? 'bg-emerald-50 text-[#0F6B4F]'
                          : s.status === 'dikirim'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-rose-50 text-rose-800'
                      }`}
                    >
                      {s.status === 'dikonfirmasi' ? '✓ Dikonfirmasi' : s.status === 'dikirim' ? '⏳ Menunggu Konfirmasi' : s.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#667085] pt-1">
                    <span>
                      Berat Kirim (W_k): <strong className="text-[#101828] font-mono">{s.weight_sent_kg} kg</strong>
                    </span>
                    {s.confirmation && (
                      <span>
                        Diterima (W'_k):{' '}
                        <strong className="text-[#0B3D2E] font-mono">
                          {s.confirmation.weight_received_kg} kg
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selected Batch Inspection Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-[#E4E7EC] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#E4E7EC] flex items-center justify-between bg-[#F8FAF9]">
              <div>
                <span className="text-[11px] font-semibold text-[#0F6B4F] uppercase">
                  Detail &amp; Neraca Batch
                </span>
                <h3 className="text-base font-bold text-[#101828] flex items-center gap-2">
                  <span>{selectedBatch.code}</span>
                  <span className="text-xs font-normal text-[#667085]">
                    · {selectedBatch.source_name}
                  </span>
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedBatch(null);
                  setActionError(null);
                  setShowCorrectModal(false);
                }}
                className="p-1 rounded-lg text-[#667085] hover:bg-slate-200 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
              {actionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Weights Table */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#F8FAF9] border border-[#E4E7EC]">
                <div>
                  <span className="text-[#667085] block">Massa Masuk (M_in):</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-mono text-[#101828]">
                      {selectedBatch.weight_in_total_kg} kg
                    </span>
                    {selectedBatch.status !== 'void' && (
                      <button
                        onClick={() => setShowCorrectModal(!showCorrectModal)}
                        className="p-1 text-[#0F6B4F] hover:bg-emerald-50 rounded cursor-pointer"
                        title="Koreksi bobot dengan alasan wajib"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[#667085] block">Status Penutupan:</span>
                  <span className="text-sm font-bold capitalize text-[#0F6B4F]">
                    {selectedBatch.status}
                  </span>
                </div>
                {selectedBatch.remaining_stock_kg !== undefined && (
                  <div>
                    <span className="text-[#667085] block">Sisa Stok (ΔS):</span>
                    <span className="text-sm font-bold font-mono">
                      {selectedBatch.remaining_stock_kg} kg
                    </span>
                  </div>
                )}
                {selectedBatch.e_kg !== undefined && (
                  <div>
                    <span className="text-[#667085] block">Closure Error (e):</span>
                    <span className="text-sm font-bold font-mono text-[#0F6B4F]">
                      {selectedBatch.e_kg} kg ({(selectedBatch.e_rel! * 100).toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Weight Correction Form (Reason Mandatory!) */}
              {showCorrectModal && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                  <span className="font-bold text-amber-900 block flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4 text-amber-700" />
                    Koreksi Bobot Masuk (Wajib Alasan)
                  </span>
                  <div>
                    <label className="text-[11px] font-semibold text-[#344054] block mb-1">
                      Bobot Koreksi Baru (kg):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={correctWeightInput}
                      onChange={(e) => setCorrectWeightInput(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-[#E4E7EC] rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#344054] block mb-1">
                      Alasan Koreksi (Wajib diisi):
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Kesalahan input ketik petugas / kalibrasi ulang timbangan"
                      value={correctReasonInput}
                      onChange={(e) => setCorrectReasonInput(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-[#E4E7EC] rounded-lg text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCorrectBatch}
                      disabled={isSubmittingAction || !correctReasonInput.trim()}
                      className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmittingAction ? 'Menyimpan...' : 'Simpan Koreksi Bobot'}
                    </button>
                    <button
                      onClick={() => setShowCorrectModal(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {/* Items breakdown */}
              {selectedBatch.items && selectedBatch.items.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold text-[#344054] block">Hasil Pilah Material:</span>
                  <div className="space-y-1">
                    {selectedBatch.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex justify-between py-1 border-b border-[#E4E7EC]"
                      >
                        <span className="text-[#667085]">{it.category_id}</span>
                        <span className="font-mono font-bold text-[#101828]">
                          {it.weight_sorted_kg} kg
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions: Close if still in 'dipilah' or 'masuk' */}
              {selectedBatch.status !== 'ditutup' && selectedBatch.status !== 'void' && (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-3">
                  <span className="font-bold text-[#0B3D2E] block">Tutup Batch Ini:</span>
                  <div>
                    <label className="text-[11px] text-[#344054] block mb-1">
                      Input Stok Sisa (ΔS) dalam fasilitas (kg):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={closingRemainingStock}
                      onChange={(e) => setClosingRemainingStock(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-[#E4E7EC] rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <button
                    onClick={handleCloseBatch}
                    disabled={isSubmittingAction}
                    className="w-full py-2 bg-[#0F6B4F] hover:bg-[#0B3D2E] text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingAction ? 'Menutup...' : 'Tutup Batch Sekarang'}
                  </button>
                </div>
              )}

              {/* Void Batch (with mandatory reason) - Hanya Pengelola dan Admin */}
              {selectedBatch.status !== 'void' && (profile?.role === 'pengelola' || profile?.role === 'admin') && (
                <div className="pt-3 border-t border-[#E4E7EC] space-y-2">
                  <span className="font-bold text-rose-800 block">Batalkan / Void Batch (Tidak Ada Hapus Keras)</span>
                  <input
                    type="text"
                    placeholder="Alasan pembatalan (wajib, minimal 5 karakter)..."
                    value={voidReasonInput}
                    onChange={(e) => setVoidReasonInput(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E4E7EC] rounded-lg text-xs"
                  />
                  <button
                    disabled={isSubmittingAction || voidReasonInput.trim().length < 5}
                    onClick={handleVoidBatch}
                    className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg disabled:opacity-50 text-xs cursor-pointer"
                  >
                    {isSubmittingAction ? 'Membatalkan...' : 'Tandai Status Void'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stepper Modal */}
      {showBatchModal && (
        <BatchCreateStepper
          onClose={() => setShowBatchModal(false)}
          onSubmit={createBatch}
        />
      )}

      {/* Shipment Modal */}
      {showShipmentModal && (
        <ShipmentCreateModal
          batches={batches.filter((b) => b.status !== 'void')}
          partners={partners}
          onClose={() => setShowShipmentModal(false)}
          onSubmit={createShipment}
        />
      )}

      {/* QR Scanner Modal */}
      {showQrModal && (
        <QRScanModal
          batches={batches}
          onClose={() => setShowQrModal(false)}
          onSelectBatch={(b) => setSelectedBatch(b)}
        />
      )}
    </div>
  );
};
