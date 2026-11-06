import React from 'react';
import { Scale, ShieldCheck, CheckCircle2, AlertTriangle, BookOpen, ArrowLeft } from 'lucide-react';

interface MetodePageProps {
  onBack: () => void;
}

export const MetodePage: React.FC<MetodePageProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-[#F8FAF9] py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Back navigation */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-[#0F6B4F] hover:text-[#0B3D2E] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Halaman Utama</span>
        </button>

        {/* Title & Introduction */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0F6B4F] uppercase tracking-wider">
            <span>Spesifikasi Ilmiah & Rekayasa</span>
            <span aria-hidden="true">·</span>
            <span>LKTIN PWT XIV 2027</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0B3D2E] tracking-tight">
            Metodologi Verifikasi Aliran Sampah Berbasis Neraca Massa
          </h1>
          <p className="text-base text-[#667085] leading-relaxed">
            Dokumentasi lengkap mengenai perumusan matematis, deteksi anomali statistik non-parametrik (R1–R7),
            definisi metrik VRR, dan batasan operasional sistem SIRKULA.
          </p>
        </div>

        {/* Section 1: Rumus Neraca Massa */}
        <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-[#E4E7EC]">
            <div className="w-8 h-8 rounded-lg bg-[#DDF4EA] flex items-center justify-center text-[#0B3D2E]">
              <Scale className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-[#101828]">1. Hukum Kekekalan Massa & Closure Error (e)</h2>
          </div>

          <p className="text-sm text-[#344054] leading-relaxed">
            Setiap batch sampah tercampur yang tiba di TPS3R dihitung keseimbangan massanya saat batch ditutup:
          </p>

          <div className="bg-[#F8FAF9] p-4 rounded-xl border border-[#E4E7EC] font-mono text-sm text-[#0B3D2E] space-y-1">
            <p className="font-bold">e = M_in − (M_rec + M_org + M_res + ΔS)</p>
            <p className="font-bold">e_rel = e / M_in</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#344054]">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <strong className="text-[#101828]">M_in:</strong> Berat total sampah tercampur saat tiba di fasilitas (kg).
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <strong className="text-[#101828]">M_rec:</strong> Berat terpilah anorganik bernilai daur ulang (plastik, kertas, logam, kaca).
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <strong className="text-[#101828]">M_org:</strong> Berat bahan organik yang diolah di tapak (kompos, biokonversi maggot BSF).
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <strong className="text-[#101828]">M_res:</strong> Berat residu yang diangkut ke TPA akhir.
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 sm:col-span-2">
              <strong className="text-[#101828]">ΔS:</strong> Stok sisa material yang masih tersimpan di fasilitas saat batch ditutup (wajib diisi eksplisit).
            </div>
          </div>
        </div>

        {/* Section 2: Konfirmasi Dua Pihak */}
        <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-[#E4E7EC]">
            <div className="w-8 h-8 rounded-lg bg-[#DDF4EA] flex items-center justify-center text-[#0B3D2E]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-[#101828]">2. Konfirmasi Dua Pihak (First-Hop Confirmation)</h2>
          </div>

          <p className="text-sm text-[#344054] leading-relaxed">
            Untuk mencegah manipulasi sepihak atas berat pengiriman daur ulang, penerima (pengepul/industri daur ulang)
            menimbang muatan dan mengisi konfirmasi secara <strong>buta (blind confirmation)</strong> melalui tautan sekali pakai:
          </p>

          <div className="bg-[#F8FAF9] p-4 rounded-xl border border-[#E4E7EC] font-mono text-sm text-[#0B3D2E]">
            <p className="font-bold">d_k = |W_k − W'_k| / W_k</p>
          </div>

          <p className="text-xs text-[#667085] leading-relaxed">
            Pengiriman dinyatakan <strong>terverifikasi</strong> jika dan hanya jika:
            <br />(a) Pihak penerima mengonfirmasi status "diterima",
            <br />(b) Selisih relatif berat kirim (W_k) dan berat terima (W'_k) tidak melebihi ambang toleransi (d_k ≤ τ_d, default 5%),
            <br />(c) Seluruh batch sumber tidak memiliki anomali R1 atau R2 berstatus aktif.
          </p>
        </div>

        {/* Section 3: Aturan Anomali R1-R7 */}
        <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-[#E4E7EC]">
            <div className="w-8 h-8 rounded-lg bg-[#DDF4EA] flex items-center justify-center text-[#0B3D2E]">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-[#101828]">3. Taksonomi Aturan Deteksi Anomali (R1–R7)</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-[#344054]">
              <thead className="bg-[#F8FAF9] text-[#101828] font-bold border-b border-[#E4E7EC]">
                <tr>
                  <th className="py-2.5 px-3">Kode</th>
                  <th className="py-2.5 px-3">Nama Aturan</th>
                  <th className="py-2.5 px-3">Kondisi Tanda</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Efek VRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC]">
                <tr>
                  <td className="py-2.5 px-3 font-mono font-bold text-[#0B3D2E]">R1</td>
                  <td className="py-2.5 px-3 font-semibold">Closure Error Tidak Wajar</td>
                  <td className="py-2.5 px-3">|z(e_rel)| &gt; 3.5 terhadap median &amp; MAD kategori dominan</td>
                  <td className="py-2.5 px-3"><span className="text-rose-600 font-bold">Tinggi</span></td>
                  <td className="py-2.5 px-3 font-medium">Mengecualikan batch</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-mono font-bold text-[#0B3D2E]">R2</td>
                  <td className="py-2.5 px-3 font-semibold">Closure Error Negatif</td>
                  <td className="py-2.5 px-3">e_rel &lt; −τ_neg (massa keluar &gt; massa masuk)</td>
                  <td className="py-2.5 px-3"><span className="text-rose-600 font-bold">Tinggi</span></td>
                  <td className="py-2.5 px-3 font-medium">Mengecualikan batch</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-mono font-bold text-[#0B3D2E]">R3</td>
                  <td className="py-2.5 px-3 font-semibold">Selisih Dua Pihak Melebihi Toleransi</td>
                  <td className="py-2.5 px-3">d_k &gt; τ_d (selisih timbang kirim vs terima &gt; 5%)</td>
                  <td className="py-2.5 px-3"><span className="text-rose-600 font-bold">Tinggi</span></td>
                  <td className="py-2.5 px-3 font-medium">Mengecualikan pengiriman</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-mono font-bold text-[#0B3D2E]">R4</td>
                  <td className="py-2.5 px-3 font-semibold">Konfirmasi Kedaluwarsa</td>
                  <td className="py-2.5 px-3">Tidak ada konfirmasi setelah batas waktu (72 jam)</td>
                  <td className="py-2.5 px-3"><span className="text-amber-600 font-bold">Sedang</span></td>
                  <td className="py-2.5 px-3 font-medium">Belum terverifikasi</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-mono font-bold text-[#0B3D2E]">R5</td>
                  <td className="py-2.5 px-3 font-semibold">Pola Harian Tidak Wajar</td>
                  <td className="py-2.5 px-3">Total masuk harian menyimpang dari median bergulir 28 hari</td>
                  <td className="py-2.5 px-3"><span className="text-[#667085] font-bold">Rendah</span></td>
                  <td className="py-2.5 px-3">Hanya peringatan</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-mono font-bold text-[#0B3D2E]">R6</td>
                  <td className="py-2.5 px-3 font-semibold">Data Tidak Lengkap</td>
                  <td className="py-2.5 px-3">Batch ditutup tanpa foto timbangan / tanpa lines</td>
                  <td className="py-2.5 px-3"><span className="text-amber-600 font-bold">Sedang</span></td>
                  <td className="py-2.5 px-3">Hanya peringatan</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-mono font-bold text-[#0B3D2E]">R7</td>
                  <td className="py-2.5 px-3 font-semibold">Preferensi Angka Bulat</td>
                  <td className="py-2.5 px-3">Proporsi timbangan berakhir 0 atau 5 di atas 20%</td>
                  <td className="py-2.5 px-3"><span className="text-[#667085] font-bold">Info</span></td>
                  <td className="py-2.5 px-3">Indikator lemah</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 4: Metrik Keputusan VRR vs RR */}
        <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-[#E4E7EC]">
            <div className="w-8 h-8 rounded-lg bg-[#DDF4EA] flex items-center justify-center text-[#0B3D2E]">
              <BookOpen className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-[#101828]">4. Metrik Keputusan Periode (RR, VRR, &amp; Gap)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-bold text-[#101828] block">Reported Recycling Rate (RR)</span>
              <p className="font-mono text-slate-700">RR = Reported Recycled (kg) / Σ M_in (kg)</p>
              <p className="text-[#667085] mt-1">Angka klaim yang dilaporkan oleh pengelola fasilitas.</p>
            </div>
            <div className="p-4 rounded-xl bg-[#F0FAF5] border border-[#A8E8D0] space-y-1">
              <span className="font-bold text-[#0B3D2E] block">Verified Recycling Rate (VRR Ketat)</span>
              <p className="font-mono text-[#0F6B4F]">VRR = Σ W'_k (terverifikasi) / Σ M_in (kg)</p>
              <p className="text-[#0F6B4F] mt-1">Hanya memperhitungkan bobot serah terima penerima yang lolos seluruh verifikasi.</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
            <div className="font-bold flex items-center justify-between">
              <span>Headline Decision Metric: Gap = RR − VRR</span>
            </div>
            <p className="leading-relaxed">
              Jika |Gap| &lt; 0.05, laporan dinilai konsisten dengan bukti fisik. Jika Gap positif besar (&gt; 0.05),
              sistem merekomendasikan pendampingan atau audit prioritas kepada Dinas Lingkungan Hidup.
            </p>
          </div>
        </div>

        {/* Section 5: Batasan Sistem (Honest Limitations) */}
        <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 sm:p-8 space-y-4">
          <h2 className="text-lg font-bold text-[#101828]">Batasan Operasional &amp; Integritas</h2>
          <p className="text-xs text-[#667085] leading-relaxed">
            Sesuai komitmen transparansi Dokumen Induk SIRKULA:
          </p>
          <ul className="space-y-2 text-xs text-[#344054] list-disc pl-5">
            <li>
              <strong>Bukan blockchain:</strong> Audit log menggunakan rantai hash SHA-256 per fasilitas di level basis data. Integritas diawasi dengan penerbitan jangkar hash mingguan.
            </li>
            <li>
              <strong>Bukan alat penuduh:</strong> Anomali adalah pemicu klarifikasi teknis (seperti kadar air akibat hujan, susut pengangkutan, atau kerusakan timbangan), bukan vonis hukum.
            </li>
            <li>
              <strong>Cakupan First-Hop:</strong> SIRKULA memverifikasi hingga gerbang serah terima pertama dan tidak memantau proses pabrik peleburan selanjutnya.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
