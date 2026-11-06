import React, { useState, useEffect } from 'react';
import { MaterialCategory, Batch } from '../../types';
import { useCategories } from '../../features/categories/useCategories';
import { balance } from '../../engine';
import {
  Camera,
  QrCode,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';

interface BatchCreateStepperProps {
  onClose: () => void;
  onSubmit: (batchData: any) => Promise<any>;
}

export const BatchCreateStepper: React.FC<BatchCreateStepperProps> = ({ onClose, onSubmit }) => {
  const { categories } = useCategories();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [sourceType, setSourceType] = useState('Permukiman');
  const [sourceName, setSourceName] = useState('');
  const [weightIn, setWeightIn] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [batchCode, setBatchCode] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Pilah Items
  const [sortedItems, setSortedItems] = useState<{ category_id: string; weight: number }[]>([
    { category_id: 'cat-pls', weight: 0 },
    { category_id: 'cat-kts', weight: 0 },
    { category_id: 'cat-org', weight: 0 },
    { category_id: 'cat-rsd', weight: 0 },
  ]);

  // Onsite Processing
  const [onsiteType, setOnsiteType] = useState<'kompos' | 'maggot'>('kompos');
  const [onsiteWeight, setOnsiteWeight] = useState('');

  // Step 4 Remaining stock
  const [remainingStock, setRemainingStock] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  // Generate 6-char batch code & QR upon opening
  useEffect(() => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'B-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setBatchCode(code);

    QRCode.toDataURL(`sirkula:b:${code}`, { width: 180, margin: 1 })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error(err));
  }, []);

  const totalSorted = sortedItems.reduce((acc, it) => acc + (it.weight || 0), 0);
  const mInNum = Number(weightIn) || 0;
  const deltaSNum = Number(remainingStock) || 0;
  const mOrgOnsite = Number(onsiteWeight) || 0;

  // Running balance preview
  const previewBalance = balance({
    mIn: mInNum,
    mRec: sortedItems
      .filter((i) => i.category_id !== 'cat-org' && i.category_id !== 'cat-rsd')
      .reduce((a, b) => a + (b.weight || 0), 0),
    mOrg: mOrgOnsite,
    mRes: sortedItems.find((i) => i.category_id === 'cat-rsd')?.weight || 0,
    deltaS: deltaSNum,
  });

  const handleNextFrom1 = () => {
    if (!mInNum || mInNum <= 0) {
      alert('Masukkan berat timbangan masuk yang valid.');
      return;
    }
    setStep(2);
  };

  const handleNextFrom2 = () => {
    setStep(3);
  };

  const handleNextFrom3 = () => {
    setStep(4);
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        source_type: sourceType,
        source_name: sourceName || 'Sumber Harian',
        weight_in_total_kg: mInNum,
        weigh_photo_path: photoPreview || '/assets/evidence/scale_default.jpg',
        items: sortedItems.filter((i) => i.weight > 0).map((i) => ({
          category_id: i.category_id,
          weight_sorted_kg: i.weight,
        })),
        onsite: mOrgOnsite > 0 ? [{ method: onsiteType, weight_kg: mOrgOnsite }] : [],
      });
      onClose();
    } catch (e) {
      console.error(e);
      alert('Gagal menyimpan batch.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-[#E4E7EC] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header with Stepper Progress */}
        <div className="p-4 sm:p-5 border-b border-[#E4E7EC] flex items-center justify-between bg-[#F8FAF9]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#0F6B4F] uppercase tracking-wider">
                Pencatatan Batch
              </span>
              <span className="text-xs font-mono font-bold text-[#0B3D2E] bg-[#DDF4EA] px-2 py-0.5 rounded">
                {batchCode}
              </span>
            </div>
            <h2 className="text-base font-bold text-[#101828] mt-0.5">
              {step === 1 && 'Langkah 1: Timbang & Foto Masuk (M_in)'}
              {step === 2 && 'Langkah 2: Pemilahan & Kompos Tapak'}
              {step === 3 && 'Langkah 3: Alokasi & Kode QR Fisik'}
              {step === 4 && 'Langkah 4: Konfirmasi Neraca & Sisa Stok'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#667085] hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="grid grid-cols-4 h-1.5 bg-slate-200">
          <div className={`h-full ${step >= 1 ? 'bg-[#0F6B4F]' : ''}`} />
          <div className={`h-full ${step >= 2 ? 'bg-[#0F6B4F]' : ''}`} />
          <div className={`h-full ${step >= 3 ? 'bg-[#0F6B4F]' : ''}`} />
          <div className={`h-full ${step >= 4 ? 'bg-[#0F6B4F]' : ''}`} />
        </div>

        {/* Form Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* STEP 1: MASUK */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="font-bold text-[#344054] block mb-1">Sumber Sampah</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {['Permukiman', 'Pasar', 'Kawasan Komersial', 'Bank Sampah', 'Lainnya'].map(
                    (src) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => setSourceType(src)}
                        className={`py-2 px-2.5 rounded-lg border text-center font-medium cursor-pointer transition-all ${
                          sourceType === src
                            ? 'bg-[#DDF4EA] text-[#0B3D2E] border-[#A8E8D0] font-bold'
                            : 'bg-white text-[#667085] border-[#E4E7EC] hover:bg-[#F8FAF9]'
                        }`}
                      >
                        {src}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#344054] block mb-1">
                  Keterangan Asal / RW / Lokasi (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: RW 05 Kelurahan Padangsari"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E4E7EC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]"
                />
              </div>

              <div>
                <label className="font-bold text-[#344054] block mb-1">
                  Berat Masuk Total (M_in) — Wajib Timbang
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    required
                    placeholder="0.0"
                    value={weightIn}
                    onChange={(e) => setWeightIn(e.target.value)}
                    className="w-full px-4 py-3 text-2xl font-extrabold font-mono text-[#0B3D2E] border border-[#E4E7EC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]"
                  />
                  <span className="absolute right-4 top-3.5 text-base font-bold text-[#667085]">
                    kg
                  </span>
                </div>
                <span className="text-[11px] text-[#667085] mt-1 block">
                  Resolusi timbangan TPS3R: 0,1 kg. Input koma atau titik didukung.
                </span>
              </div>

              <div>
                <label className="font-bold text-[#344054] block mb-1">
                  Foto Bukti Timbangan (Kamera / Unggah)
                </label>
                <div className="p-3 border-2 border-dashed border-[#E4E7EC] rounded-xl flex items-center gap-3 bg-[#F8FAF9]">
                  <div className="w-14 h-14 rounded-lg bg-emerald-100/60 overflow-hidden shrink-0 flex items-center justify-center">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-6 h-6 text-[#0F6B4F]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-[#101828] block">
                      Foto Angka Display Timbangan
                    </span>
                    <span className="text-[11px] text-[#667085] block truncate">
                      Patuhi privasi: jangan memuat wajah orang dalam foto.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoPreview(
                        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect width="200" height="150" fill="%23E8F8F0"/><text x="100" y="75" text-anchor="middle" font-family="sans-serif" font-size="12" fill="%230F6B4F" font-weight="bold">FOTO TIMBANGAN TERVERIFIKASI</text></svg>'
                      )
                    }
                    className="px-2.5 py-1.5 text-xs font-bold text-[#0F6B4F] bg-white border border-[#A8E8D0] rounded-lg shadow-2xs hover:bg-[#DDF4EA] cursor-pointer"
                  >
                    Simulasi Foto
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PILAH & OLAH */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3 bg-[#F8FAF9] rounded-xl border border-[#E4E7EC] flex items-center justify-between">
                <div>
                  <span className="text-[#667085] block text-[11px]">Berat Tiba (M_in):</span>
                  <span className="text-sm font-bold text-[#101828] font-mono">{mInNum} kg</span>
                </div>
                <div>
                  <span className="text-[#667085] block text-[11px]">Total Pilah Berjalan:</span>
                  <span
                    className={`text-sm font-bold font-mono ${
                      totalSorted > mInNum ? 'text-rose-600' : 'text-[#0F6B4F]'
                    }`}
                  >
                    {totalSorted.toFixed(1)} kg
                  </span>
                </div>
              </div>

              {totalSorted > mInNum && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-amber-900 text-[11px]">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    Peringatan: Total hasil pilah ({totalSorted.toFixed(1)} kg) melebihi berat masuk ({mInNum} kg).
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <span className="font-bold text-[#344054] block">Hasil Pilah Per Kategori</span>
                {categories.map((cat) => {
                  const current = sortedItems.find((i) => i.category_id === cat.id)?.weight || 0;
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#E4E7EC]"
                    >
                      <span className="font-medium text-[#101828]">{cat.name}</span>
                      <div className="flex items-center gap-1.5 w-32">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={current === 0 ? '' : current}
                          placeholder="0.0"
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setSortedItems((prev) => {
                              const exists = prev.find((p) => p.category_id === cat.id);
                              if (exists) {
                                return prev.map((p) =>
                                  p.category_id === cat.id ? { ...p, weight: val } : p
                                );
                              }
                              return [...prev, { category_id: cat.id, weight: val }];
                            });
                          }}
                          className="w-full text-right px-2 py-1 font-mono font-bold text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#0F6B4F]"
                        />
                        <span className="text-[#667085] font-semibold text-[11px]">kg</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Onsite Organics */}
              <div className="pt-2 border-t border-[#E4E7EC] space-y-2">
                <span className="font-bold text-[#344054] block">
                  Pengolahan Organik di Tapak (M_org)
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={onsiteType}
                    onChange={(e) => setOnsiteType(e.target.value as any)}
                    className="px-3 py-1.5 border border-[#E4E7EC] rounded-lg text-xs"
                  >
                    <option value="kompos">Kompos Aerobik</option>
                    <option value="maggot">Biokonversi Maggot BSF</option>
                  </select>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Berat masuk olah (kg)"
                      value={onsiteWeight}
                      onChange={(e) => setOnsiteWeight(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold border border-[#E4E7EC] rounded-lg"
                    />
                    <span className="absolute right-3 top-1.5 text-slate-400 font-semibold">kg</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: KODE QR & KELUAR */}
          {step === 3 && (
            <div className="space-y-4 text-center">
              <p className="text-xs text-[#667085]">
                Label fisik QR Code untuk ditempel di bak kontainer batch ini di TPS3R:
              </p>

              <div className="p-4 bg-[#F8FAF9] rounded-2xl border border-[#E4E7EC] inline-block mx-auto shadow-2xs">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="w-36 h-36 mx-auto rounded-lg" />
                ) : (
                  <div className="w-36 h-36 bg-slate-200 rounded-lg animate-pulse" />
                )}
                <div className="mt-2 font-mono font-extrabold text-sm text-[#0B3D2E] tracking-widest">
                  {batchCode}
                </div>
                <span className="text-[10px] text-[#667085] block mt-0.5">
                  SIRKULA VERIFIED BATCH
                </span>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-left text-xs text-[#0F6B4F] space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  ID Dibuat di Perangkat (Offline-Ready)
                </span>
                <p className="text-[11px] leading-relaxed">
                  Kode fisik ini dapat dipindai langsung oleh pengemudi angkut atau dicari manual dengan kode 6 karakter.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: TUTUP BATCH & SISA STOK */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#F0FAF5] border border-[#A8E8D0] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#0B3D2E]">Ringkasan Neraca Massa</span>
                  <span className="text-[10px] bg-white text-[#0B3D2E] font-bold px-2 py-0.5 rounded border border-[#A8E8D0]">
                    Pratinjau
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#667085]">Massa Masuk (M_in):</span>
                    <span className="font-mono font-bold block">{mInNum} kg</span>
                  </div>
                  <div>
                    <span className="text-[#667085]">Hasil Pilah & Olah:</span>
                    <span className="font-mono font-bold block">
                      {(totalSorted + mOrgOnsite).toFixed(1)} kg
                    </span>
                  </div>
                  <div>
                    <span className="text-[#667085]">Closure Error (e):</span>
                    <span className="font-mono font-bold block text-[#0F6B4F]">
                      {previewBalance.e.toFixed(1)} kg
                    </span>
                  </div>
                  <div>
                    <span className="text-[#667085]">Relative Error (e_rel):</span>
                    <span className="font-mono font-bold block text-[#0F6B4F]">
                      {previewBalance.eRel !== null ? (previewBalance.eRel * 100).toFixed(1) + '%' : '-'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[#344054] block">
                  Stok Sisa Batch yang Masih Disimpan (ΔS)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={remainingStock}
                    onChange={(e) => setRemainingStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono font-bold border border-[#E4E7EC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-[#667085]">
                    kg
                  </span>
                </div>
                <span className="text-[11px] text-[#667085] block">
                  Wajib diisi angka (boleh 0 jika seluruh sampah telah habis dipilah dan dikirim).
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="p-4 border-t border-[#E4E7EC] flex items-center justify-between bg-white">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="px-4 py-2 text-xs font-semibold text-[#667085] hover:text-[#101828] flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1) handleNextFrom1();
                else if (step === 2) handleNextFrom2();
                else if (step === 3) handleNextFrom3();
              }}
              className="px-5 py-2 text-xs font-bold text-white bg-[#0F6B4F] hover:bg-[#0B3D2E] rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <span>Lanjut</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleFinalSubmit}
              className="px-6 py-2.5 text-xs font-bold text-white bg-[#0F6B4F] hover:bg-[#0B3D2E] rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Menyimpan...' : 'Tutup & Simpan Batch'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
