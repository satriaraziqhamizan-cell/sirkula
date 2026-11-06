import React, { useState } from 'react';
import { Batch, Partner, OutboundPurpose, Shipment } from '../../types';
import { useCategories } from '../../features/categories/useCategories';
import { supabase } from '../../lib/supabase';
import { X, Send, Copy, QrCode, CheckCircle2, MessageCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface ShipmentCreateModalProps {
  batches: Batch[];
  partners: Partner[];
  onClose: () => void;
  onSubmit: (shipmentData: any) => Promise<any>;
}

export const ShipmentCreateModal: React.FC<ShipmentCreateModalProps> = ({
  batches,
  partners,
  onClose,
  onSubmit,
}) => {
  const { categories } = useCategories();
  const [purpose, setPurpose] = useState<OutboundPurpose>('daur_ulang');
  const [partnerId, setPartnerId] = useState(partners[0]?.id || '');
  const [selectedBatchId, setSelectedBatchId] = useState(batches[0]?.id || '');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-pls');
  const [weightKg, setWeightKg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdShipment, setCreatedShipment] = useState<Shipment | null>(null);
  const [tokenUrl, setTokenUrl] = useState<string>('');
  const [isReissuing, setIsReissuing] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedPartner = partners.find((p) => p.id === partnerId);
  const selectedBatch = batches.find((b) => b.id === selectedBatchId);

  const generateTokenForShipment = async (shipmentId: string) => {
    try {
      const { data, error } = await supabase.rpc('create_shipment_token', {
        p_shipment_id: shipmentId,
      });
      if (error) throw error;
      if (data?.ok && data?.token) {
        const fullUrl = `${window.location.origin}/k/${data.token}`;
        setTokenUrl(fullUrl);
        return fullUrl;
      }
    } catch (err) {
      console.warn('Gagal membuat token lewat RPC, fallback URL:', err);
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = Number(weightKg);
    if (!w || w <= 0) {
      alert('Masukkan berat kirim yang valid.');
      return;
    }

    setSubmitting(true);
    try {
      const shp = await onSubmit({
        partner_id: partnerId,
        purpose,
        lines: [
          {
            batch_id: selectedBatchId,
            category_id: categoryId,
            weight_kg: w,
          },
        ],
      });
      setCreatedShipment(shp);
      if (shp?.id) {
        await generateTokenForShipment(shp.id);
      }
    } catch (err) {
      console.error(err);
      alert('Gagal membuat pengiriman.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReissueToken = async () => {
    if (!createdShipment?.id) return;
    setIsReissuing(true);
    try {
      await generateTokenForShipment(createdShipment.id);
      alert('Tautan konfirmasi baru berhasil diterbitkan. Tautan lama otomatis dicabut.');
    } catch (err: any) {
      alert(err.message || 'Gagal menerbitkan ulang token.');
    } finally {
      setIsReissuing(false);
    }
  };

  const confirmUrl = tokenUrl || (createdShipment?.id ? `${window.location.origin}/k?shipment=${createdShipment.id}` : '');

  const copyLink = () => {
    if (!confirmUrl) return;
    navigator.clipboard.writeText(confirmUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    if (!confirmUrl) return;
    const phone = selectedPartner?.phone ? selectedPartner.phone.replace(/\D/g, '') : '';
    const text = encodeURIComponent(
      `Halo ${selectedPartner?.name || 'Mitra'}, mohon konfirmasi berat penerimaan sampah daur ulang melalui tautan resmi SIRKULA berikut:\n${confirmUrl}\n\n(Tautan sekali pakai, tanpa login)`
    );
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-[#E4E7EC] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E4E7EC] flex items-center justify-between bg-[#F8FAF9]">
          <div>
            <span className="text-xs font-bold text-[#0F6B4F] uppercase tracking-wider">
              Serah Terima Keluar
            </span>
            <h2 className="text-base font-bold text-[#101828]">Kirim Muatan ke Mitra</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#667085] hover:bg-slate-200 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {createdShipment ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-12 h-12 rounded-full bg-[#DDF4EA] text-[#0F6B4F] mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#101828]">Pengiriman Berhasil Dicatat</h3>
                <p className="text-xs text-[#667085] mt-1">
                  ID: <span className="font-mono font-bold text-[#0B3D2E]">{createdShipment.id}</span> · {createdShipment.weight_sent_kg} kg
                </p>
              </div>

              {/* Share Actions */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={shareWhatsApp}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#25D366] text-white font-bold flex items-center justify-center gap-2 shadow-xs hover:bg-[#20ba59] transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Kirim Tautan via WhatsApp</span>
                </button>

                <button
                  onClick={copyLink}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#101828] font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-[#667085]" />
                  <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin Tautan Konfirmasi'}</span>
                </button>

                <button
                  onClick={handleReissueToken}
                  disabled={isReissuing}
                  className="w-full py-2 px-4 rounded-xl border border-[#E4E7EC] hover:bg-slate-50 text-[#344054] font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#0F6B4F] ${isReissuing ? 'animate-spin' : ''}`} />
                  <span>{isReissuing ? 'Menerbitkan Ulang...' : 'Terbitkan Ulang Tautan'}</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-left text-amber-900 text-[11px] space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                  <span>Prinsip Konfirmasi Buta (Blind)</span>
                </div>
                <p>
                  Penerima tidak akan melihat angka {createdShipment.weight_sent_kg} kg ini di tautan mereka. Mereka akan menginput berat timbangan asli mereka sendiri.
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2 text-xs font-semibold text-[#667085] hover:text-[#101828]"
              >
                Selesai
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Purpose Selection */}
              <div>
                <label className="font-bold text-[#344054] block mb-1">Tujuan Pengiriman</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'daur_ulang', label: 'Daur Ulang' },
                    { id: 'organik_olah', label: 'Organik Olah' },
                    { id: 'residu', label: 'Residu TPA' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPurpose(p.id as any)}
                      className={`py-2 px-2 rounded-lg border text-center font-medium cursor-pointer transition-all ${
                        purpose === p.id
                          ? 'bg-[#DDF4EA] text-[#0B3D2E] border-[#A8E8D0] font-bold'
                          : 'bg-white text-[#667085] border-[#E4E7EC] hover:bg-[#F8FAF9]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Partner Select */}
              <div>
                <label className="font-bold text-[#344054] block mb-1">Pilih Mitra Penerima</label>
                <select
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E4E7EC] rounded-lg text-xs"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.partner_type})
                    </option>
                  ))}
                </select>
                {selectedPartner?.phone && (
                  <span className="text-[11px] text-[#667085] mt-1 block">
                    No. WhatsApp: {selectedPartner.phone}
                  </span>
                )}
              </div>

              {/* Batch Source Select */}
              <div>
                <label className="font-bold text-[#344054] block mb-1">Pilih Batch Sumber</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E4E7EC] rounded-lg text-xs"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} · {b.source_name} ({b.weight_in_total_kg} kg)
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Select */}
              <div>
                <label className="font-bold text-[#344054] block mb-1">Kategori Material</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E4E7EC] rounded-lg text-xs"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Weight Input */}
              <div>
                <label className="font-bold text-[#344054] block mb-1">
                  Berat Kirim Timbangan TPS3R (W_k)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-2.5 text-lg font-mono font-bold text-[#0B3D2E] border border-[#E4E7EC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]"
                  />
                  <span className="absolute right-4 top-2.5 text-sm font-bold text-[#667085]">
                    kg
                  </span>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 text-xs font-bold text-white bg-[#0F6B4F] hover:bg-[#0B3D2E] rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Menyiapkan...' : 'Buat Tautan Konfirmasi'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
