import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Logo } from '../Logo';
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Camera,
  Scale,
  Building2,
  Calendar,
  Layers,
  Loader2,
  FileText,
} from 'lucide-react';

interface ConfirmationData {
  facility_name: string;
  partner_name: string;
  partner_type?: string;
  purpose: string;
  shipped_at: string;
  materials: string[];
  expires_at: string;
}

export const RecipientConfirmPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { token: routeToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = routeToken || searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationData, setConfirmationData] = useState<ConfirmationData | null>(null);

  // Form states
  const [weightReceived, setWeightReceived] = useState('');
  const [status, setStatus] = useState<'diterima' | 'ditolak_tidak_sesuai'>('diterima');
  const [note, setNote] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrorStatus(400);
      setErrorMessage('Token konfirmasi tidak disertakan dalam tautan.');
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      setErrorStatus(null);
      setErrorMessage(null);

      try {
        if (!isSupabaseConfigured) {
          // Fallback UI preview if Supabase is not connected
          setErrorStatus(503);
          setErrorMessage('Layanan database belum terhubung. Konfigurasi VITE_SUPABASE_URL terlebih dahulu.');
          setLoading(false);
          return;
        }

        // Call get_confirmation_details RPC
        const { data, error } = await supabase.rpc('get_confirmation_details', {
          p_token: token.trim(),
        });

        if (error) {
          throw error;
        }

        if (data.status === 200 && data.data) {
          setConfirmationData(data.data);
        } else {
          setErrorStatus(data.status || 400);
          setErrorMessage(data.message || 'Gagal memuat data konfirmasi.');
        }
      } catch (err: any) {
        console.error('Error fetching confirmation token:', err);
        setErrorStatus(500);
        setErrorMessage(err.message || 'Terjadi kesalahan sistem saat memverifikasi token.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [token]);

  // Client-side photo compression
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scale = MAX_WIDTH / img.width;
        canvas.width = Math.min(img.width, MAX_WIDTH);
        canvas.height = img.height * (canvas.width / img.width);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setPhotoPreview(compressedDataUrl);
          setPhotoPath(`evidence/conf_${Date.now()}_receipt.jpg`);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = Number(weightReceived);
    if (isNaN(w) || w < 0) {
      alert('Mohon masukkan angka timbangan yang valid (angka non-negatif).');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('submit_blind_confirmation', {
        p_token: token.trim(),
        p_weight_received: w,
        p_status: status,
        p_note: note.trim() || null,
        p_photo_path: photoPath,
      });

      if (error) {
        throw error;
      }

      if (data.status === 200) {
        setIsSuccess(true);
      } else {
        alert(data.message || 'Gagal mengirimkan konfirmasi penerimaan.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Terjadi kesalahan saat memproses konfirmasi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => (onBack ? onBack() : navigate('/'))}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0F6B4F] hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Beranda</span>
          </button>
          <span className="text-[11px] font-semibold text-[#667085] bg-white px-2.5 py-1 rounded-full border border-[#E4E7EC]">
            Portal Penerima Material
          </span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E4E7EC] shadow-sm space-y-6">
          <div className="flex justify-center">
            <Logo size="md" />
          </div>

          {/* Loading State */}
          {loading && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#0F6B4F] mx-auto" />
              <p className="text-xs text-[#667085] font-medium">Memeriksa keabsahan tautan konfirmasi...</p>
            </div>
          )}

          {/* Error States (400, 404, 410, 429) */}
          {!loading && errorStatus && (
            <div className="py-6 text-center space-y-4">
              <div
                className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${
                  errorStatus === 410
                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                    : 'bg-rose-50 text-rose-600 border border-rose-200'
                }`}
              >
                {errorStatus === 410 ? <Clock className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
              </div>

              <div className="space-y-1">
                <h2 className="text-base font-bold text-[#101828]">
                  {errorStatus === 404
                    ? 'Tautan Tidak Ditemukan'
                    : errorStatus === 410
                    ? 'Tautan Tidak Lagi Berlaku'
                    : errorStatus === 429
                    ? 'Batas Percobaan Terlampaui'
                    : 'Terjadi Kendala Konfirmasi'}
                </h2>
                <p className="text-xs text-[#667085] leading-relaxed max-w-sm mx-auto">
                  {errorMessage}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-[#E4E7EC] text-left text-xs text-[#667085] space-y-2">
                <span className="font-bold text-[#344054] block">Bantuan &amp; Petunjuk:</span>
                <p className="text-[11px] leading-relaxed">
                  Tautan konfirmasi SIRKULA bersifat sekali pakai (one-time token) dan kedaluwarsa otomatis sesuai toleransi fasilitas (72 jam). Jika Anda adalah mitra yang sah dan tautan telah kedaluwarsa, silakan hubungi petugas fasilitas TPS 3R terkait untuk menerbitkan ulang tautan konfirmasi baru.
                </p>
              </div>
            </div>
          )}

          {/* Success State */}
          {!loading && isSuccess && (
            <div className="py-6 text-center space-y-5">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-[#0F6B4F] mx-auto flex items-center justify-center border border-emerald-200">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-[#101828]">Konfirmasi Berhasil Dicatat</h2>
                <p className="text-xs text-[#667085] leading-relaxed">
                  Terima kasih. Data timbangan Anda telah direkam secara resmi dan dikunci ke dalam audit trail berantai SIRKULA.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-left text-xs space-y-2">
                <div className="flex justify-between text-[#0B3D2E]">
                  <span className="text-[#667085]">Fasilitas Pengirim:</span>
                  <span className="font-bold">{confirmationData?.facility_name}</span>
                </div>
                <div className="flex justify-between text-[#0B3D2E]">
                  <span className="text-[#667085]">Berat Timbangan Anda:</span>
                  <span className="font-bold font-mono text-sm">{weightReceived} kg</span>
                </div>
                <div className="flex justify-between text-[#0B3D2E]">
                  <span className="text-[#667085]">Status Verifikasi:</span>
                  <span className="font-bold capitalize">{status.replace('_', ' ')}</span>
                </div>
              </div>

              <button
                onClick={() => (onBack ? onBack() : navigate('/'))}
                className="w-full py-2.5 bg-[#0F6B4F] hover:bg-[#0B3D2E] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Selesai &amp; Tutup
              </button>
            </div>
          )}

          {/* Form State */}
          {!loading && !errorStatus && !isSuccess && confirmationData && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <span className="text-xs font-bold text-[#0F6B4F] uppercase tracking-wider block">
                  Protokol Konfirmasi Buta
                </span>
                <h1 className="text-lg font-bold text-[#101828]">
                  Konfirmasi Penerimaan Material
                </h1>
                <p className="text-xs text-[#667085] mt-1 leading-relaxed">
                  Masukkan hasil timbangan nyata yang diterima di tempat Anda secara independen.
                </p>
              </div>

              {/* Shipment Details Card (NO WEIGHT LEAKED) */}
              <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-[#E4E7EC] space-y-2.5 text-xs">
                <div className="flex items-center gap-2 text-[#344054]">
                  <Building2 className="w-4 h-4 text-[#0F6B4F] shrink-0" />
                  <span className="text-[#667085]">Asal Fasilitas:</span>
                  <strong className="text-[#101828] font-semibold">{confirmationData.facility_name}</strong>
                </div>

                <div className="flex items-center gap-2 text-[#344054]">
                  <Calendar className="w-4 h-4 text-[#0F6B4F] shrink-0" />
                  <span className="text-[#667085]">Tanggal Kirim:</span>
                  <span className="text-[#101828]">
                    {new Date(confirmationData.shipped_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[#344054]">
                  <Layers className="w-4 h-4 text-[#0F6B4F] shrink-0" />
                  <span className="text-[#667085]">Jenis Material:</span>
                  <span className="text-[#101828] font-medium">
                    {confirmationData.materials.length > 0
                      ? confirmationData.materials.join(', ')
                      : 'Material Daur Ulang'}
                  </span>
                </div>

                <div className="pt-2 border-t border-[#E4E7EC] flex items-center gap-1.5 text-[11px] text-amber-800">
                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    Batas konfirmasi s.d.{' '}
                    <strong>
                      {new Date(confirmationData.expires_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Blind Principle Info */}
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 text-[11px] text-[#0B3D2E] leading-relaxed flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0F6B4F] shrink-0 mt-0.5" />
                <span>
                  <strong>Konfirmasi Dua Pihak:</strong> Angka timbangan pengirim tidak ditampilkan kepada Anda untuk menjamin verifikasi independen (Ground Truth) dan transparansi pelaporan daur ulang.
                </span>
              </div>

              {/* Weight Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#344054] flex items-center justify-between">
                  <span>Berat Bersih Diterima di Lokasi Anda (kg) *</span>
                  <span className="text-[11px] font-normal text-[#667085]">Wajib diisi</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="Contoh: 142.5"
                    value={weightReceived}
                    onChange={(e) => setWeightReceived(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#E4E7EC] rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]/20 focus:border-[#0F6B4F]"
                  />
                  <span className="absolute right-4 top-2.5 text-xs font-bold text-[#667085]">kg</span>
                </div>
              </div>

              {/* Status Radio */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#344054] block">
                  Kesesuaian Muatan Material *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStatus('diterima')}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      status === 'diterima'
                        ? 'bg-emerald-50 border-[#0F6B4F] text-[#0B3D2E]'
                        : 'bg-white border-[#E4E7EC] text-[#667085] hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className={`w-4 h-4 ${status === 'diterima' ? 'text-[#0F6B4F]' : 'text-slate-400'}`} />
                    <span>Muatan Sesuai</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('ditolak_tidak_sesuai')}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      status === 'ditolak_tidak_sesuai'
                        ? 'bg-rose-50 border-rose-500 text-rose-800'
                        : 'bg-white border-[#E4E7EC] text-[#667085] hover:bg-slate-50'
                    }`}
                  >
                    <XCircle className={`w-4 h-4 ${status === 'ditolak_tidak_sesuai' ? 'text-rose-600' : 'text-slate-400'}`} />
                    <span>Ditolak / Selisih</span>
                  </button>
                </div>
              </div>

              {/* Optional Photo */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#344054] flex items-center justify-between">
                  <span>Foto Bukti Timbangan / Surat Jalan (Opsional)</span>
                  <span className="text-[11px] font-normal text-[#667085]">Maks 800px</span>
                </label>

                {photoPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-[#E4E7EC] h-32 bg-slate-50 flex items-center justify-center">
                    <img src={photoPreview} alt="Bukti timbangan" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoPreview(null);
                        setPhotoPath(null);
                      }}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="border border-dashed border-[#E4E7EC] hover:border-[#0F6B4F] rounded-xl p-3.5 flex items-center justify-center gap-2 cursor-pointer bg-[#F8FAF9] text-xs text-[#667085] hover:bg-white transition-colors">
                    <Camera className="w-4 h-4 text-[#0F6B4F]" />
                    <span>Ambil Foto atau Pilih Gambar</span>
                    <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                )}
              </div>

              {/* Optional Note */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#344054] block">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan kondisi material, kadar air, atau nomor nota timbang..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-[#E4E7EC] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]/20 focus:border-[#0F6B4F]"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !weightReceived}
                className="w-full py-3 bg-[#0F6B4F] hover:bg-[#0B3D2E] text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengirimkan Konfirmasi...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Kirim Konfirmasi Resmi</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
