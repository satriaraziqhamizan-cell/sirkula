import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, OutboxItem } from '../../lib/db';
import { syncManager } from '../../lib/sync';
import {
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wifi,
  WifiOff,
  Trash2,
  Layers,
  Database,
} from 'lucide-react';

export const SyncStatusPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const loadOutbox = async () => {
    const list = await db.outbox.orderBy('seq_local').reverse().toArray();
    setItems(list);
  };

  useEffect(() => {
    loadOutbox();

    const unsubscribe = syncManager.subscribe((state) => {
      setIsOnline(state.isOnline);
      setIsSyncing(state.isSyncing);
      loadOutbox();
    });

    return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncManager.sync();
    await loadOutbox();
    setIsSyncing(false);
  };

  const handleDeleteItem = async (id?: number) => {
    if (!id) return;
    if (confirm('Hapus item antrean ini secara manual?')) {
      await db.outbox.delete(id);
      await loadOutbox();
    }
  };

  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const failedCount = items.filter((i) => i.status === 'failed').length;
  const reviewCount = items.filter((i) => i.status === 'needs_review').length;

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full mx-auto space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0F6B4F] hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali</span>
          </button>
          <span className="text-[11px] font-semibold text-[#667085] bg-white px-2.5 py-1 rounded-full border border-[#E4E7EC]">
            Manajer Sinkronisasi Offline (C-Lite)
          </span>
        </div>

        {/* Header Card */}
        <div className="bg-white rounded-3xl p-6 border border-[#E4E7EC] shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-[#0F6B4F] border border-emerald-200">
                    <Wifi className="w-3 h-3" /> Terhubung Online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-[#667085] border border-slate-300">
                    <WifiOff className="w-3 h-3" /> Mode Offline
                  </span>
                )}
                {isSyncing && (
                  <span className="text-xs text-amber-700 font-semibold animate-pulse">
                    Sedang menyelaraskan data...
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-[#101828] mt-1.5">
                Antrean Sinkronisasi Perangkat
              </h1>
              <p className="text-xs text-[#667085] mt-0.5 leading-relaxed">
                Setiap transaksi lapangan dicatat lebih dulu ke Dexie di peramban ini dan dikirim berurutan saat online.
              </p>
            </div>

            <button
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
              className="px-4 py-2 bg-[#0F6B4F] hover:bg-[#0B3D2E] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
            </button>
          </div>

          {/* Counts overview */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-[#E4E7EC] text-center">
              <span className="text-[11px] text-[#667085] block">Menunggu Kirim</span>
              <span className="text-lg font-bold font-mono text-amber-600">{pendingCount}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-[#E4E7EC] text-center">
              <span className="text-[11px] text-[#667085] block">Gagal Jaringan</span>
              <span className="text-lg font-bold font-mono text-rose-600">{failedCount}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-[#E4E7EC] text-center">
              <span className="text-[11px] text-[#667085] block">Perlu Ditinjau</span>
              <span className="text-lg font-bold font-mono text-purple-600">{reviewCount}</span>
            </div>
          </div>
        </div>

        {/* Queue List */}
        <div className="bg-white rounded-3xl p-6 border border-[#E4E7EC] shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
            <h2 className="text-sm font-bold text-[#101828]">Daftar Operasi Antrean ({items.length})</h2>
            <span className="text-xs text-[#667085]">
              {items.length === 0 ? 'Semua data telah tersinkronisasi bersih' : 'Disimpan di IndexedDB lokal'}
            </span>
          </div>

          {items.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#0F6B4F] mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-[#101828]">Tidak Ada Antrean Menunggu</p>
              <p className="text-[11px] text-[#667085]">
                Seluruh data penimbangan dan pencatatan telah tersimpan sempurna di server PostgreSQL.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-[#E4E7EC] bg-[#F8FAF9] text-xs space-y-2 hover:bg-white transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#0B3D2E] bg-white px-2 py-0.5 rounded border border-[#E4E7EC]">
                        #{item.seq_local}
                      </span>
                      <span className="font-bold text-[#101828] capitalize">
                        {item.op_type}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : item.status === 'failed'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                        title="Hapus dari antrean"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {item.error_message && (
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                      <strong>Pesan Server:</strong> {item.error_message}
                    </div>
                  )}

                  <div className="text-[11px] text-[#667085] flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-[#E4E7EC]">
                    <span>Waktu Klien: {new Date(item.client_time).toLocaleTimeString()}</span>
                    <span>Percobaan: {item.retry_count}x</span>
                    <span className="font-mono">ID: {item.client_op_id.slice(0, 8)}...</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
