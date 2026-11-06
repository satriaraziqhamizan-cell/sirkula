import React, { useState } from 'react';
import { Logo } from '../Logo';
import {
  Scale,
  ShieldCheck,
  FileCheck2,
  GitBranch,
  ArrowRight,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Smartphone,
  ExternalLink,
  QrCode,
  Lock,
} from 'lucide-react';
import { PeriodReport } from '../../types';
import { usePeriods } from '../../features/periods/usePeriods';
import { useNavigate } from 'react-router-dom';

interface LandingPageProps {
  reports?: PeriodReport[];
  onNavigate?: (nav: string, reportId?: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = (props) => {
  const navigate = useNavigate();
  const { reports: hookReports } = usePeriods(undefined, true);
  const reports = props.reports || hookReports;

  const onNavigate = props.onNavigate || ((nav: string, reportId?: string) => {
    if (nav === 'verifikasi') {
      navigate(reportId ? `/verifikasi/${reportId}` : '/verifikasi');
    } else {
      navigate(`/${nav}`);
    }
  });

  const [verifyInput, setVerifyInput] = useState('');

  // Calculate live aggregate stats from reports
  const totalInKg = reports.reduce((acc, r) => acc + (r.total_in_kg || 0), 0);
  const totalVerifiedKg = reports.reduce((acc, r) => acc + (r.verified_kg || 0), 0);
  const totalReportedKg = reports.reduce((acc, r) => acc + (r.reported_recycled_kg || 0), 0);

  const avgVRR = totalInKg > 0 ? (totalVerifiedKg / totalInKg) * 100 : 0;
  const avgRR = totalInKg > 0 ? (totalReportedKg / totalInKg) * 100 : 0;
  const avgGap = avgRR - avgVRR;

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyInput.trim()) {
      onNavigate('verifikasi', verifyInput.trim());
    } else {
      onNavigate('verifikasi', reports[0]?.id || 'rep-fac1-okt26');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9]">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white border-b border-[#E4E7EC] pt-14 pb-16 lg:pt-20 lg:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              {/* Quiet kicker with typographic separator */}
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0F6B4F]">
                <span>Standar Verifikasi Aliran Sampah TPS3R</span>
                <span aria-hidden="true">·</span>
                <span>Berbasis Neraca Massa & First-Hop Confirmation</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0B3D2E] tracking-tight leading-[1.15] text-balance">
                Buktikan angka daur ulang dengan neraca massa terverifikasi.
              </h1>

              <p className="text-base sm:text-lg text-[#667085] leading-relaxed max-w-2xl">
                SIRKULA mencocokkan massa masuk, hasil pilah, pengolahan tapak, dan bukti serah terima
                pengepul secara berantai hash untuk menghasilkan satu metrik keputusan objektif:{' '}
                <strong className="text-[#101828] font-semibold">Verified Recycling Rate (VRR)</strong>.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => onNavigate('petugas')}
                  className="px-5 py-3 text-sm font-bold text-white bg-[#0F6B4F] hover:bg-[#0B3D2E] rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Mulai Catat di TPS3R</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onNavigate('dinas')}
                  className="px-5 py-3 text-sm font-semibold text-[#101828] bg-white hover:bg-[#F8FAF9] border border-[#E4E7EC] rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Scale className="w-4 h-4 text-[#0F6B4F]" />
                  <span>Buka Dasbor Dinas</span>
                </button>
                <button
                  onClick={() => onNavigate('metode')}
                  className="px-4 py-3 text-sm font-medium text-[#667085] hover:text-[#0B3D2E] transition-colors cursor-pointer"
                >
                  Pelajari Rumus & Aturan →
                </button>
              </div>

              {/* Trust statement */}
              <div className="pt-4 border-t border-[#E4E7EC] flex flex-wrap items-center gap-6 text-xs text-[#667085]">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-[#1FA37A]" />
                  <span>Audit Trail Berantai SHA-256</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-[#1FA37A]" />
                  <span>Konfirmasi Dua Pihak (Blind)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-[#1FA37A]" />
                  <span>Dukungan Offline-First di Lapangan</span>
                </div>
              </div>
            </div>

            {/* Interactive Card: The Core VRR vs RR Metric Explanation */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl border border-[#E4E7EC] shadow-sm p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#E4E7EC]">
                  <div>
                    <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider">
                      Metrik Utama Sistem
                    </span>
                    <h3 className="text-base font-bold text-[#101828]">Perbandingan Akurasi Laporan</h3>
                  </div>
                  <span className="text-xs font-medium bg-[#DDF4EA] text-[#0B3D2E] px-2.5 py-1 rounded-full">
                    Periode Berjalan
                  </span>
                </div>

                {/* The Two Metrics Comparison */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-[#667085] block">Klaim Pengelola (RR)</span>
                    <div className="text-2xl font-extrabold text-[#101828] tabular-nums mt-1">
                      {avgRR.toFixed(1)}%
                    </div>
                    <span className="text-[11px] text-[#667085] mt-1 block">
                      Recycling Rate laporan
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F0FAF5] border border-[#A8E8D0]">
                    <span className="text-xs font-semibold text-[#0F6B4F] block">Terverifikasi (VRR)</span>
                    <div className="text-2xl font-extrabold text-[#0B3D2E] tabular-nums mt-1">
                      {avgVRR.toFixed(1)}%
                    </div>
                    <span className="text-[11px] text-[#0F6B4F] mt-1 block">
                      Bukti timbang konfirmasi
                    </span>
                  </div>
                </div>

                {/* The Discrepancy GAP */}
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-900">Selisih Verifikasi (Gap = RR − VRR)</span>
                      <div className="text-xl font-extrabold text-amber-950 tabular-nums">
                        +{avgGap.toFixed(1)}%
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-800">
                      <TrendingDown className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-xs text-amber-900/80 mt-2 leading-relaxed">
                    Angka klaim daur ulang melampaui bukti yang terverifikasi sebesar {avgGap.toFixed(1)}%.
                    Ini memicu prioritas pemeriksaan tanpa praduga subjektif.
                  </p>
                </div>

                {/* Fast Public Verification Form */}
                <form onSubmit={handleVerifySubmit} className="space-y-2 pt-2">
                  <label className="text-xs font-semibold text-[#344054] block">
                    Cek Integritas Laporan Publik
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Masukkan ID / Hash Laporan (cth: rep-fac1-okt26)"
                      value={verifyInput}
                      onChange={(e) => setVerifyInput(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs border border-[#E4E7EC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-bold text-white bg-[#0F6B4F] hover:bg-[#0B3D2E] rounded-lg transition-colors cursor-pointer"
                    >
                      Verifikasi
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Step Verification Workflow */}
      <section className="py-16 bg-[#F8FAF9] border-b border-[#E4E7EC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-[#0F6B4F] uppercase tracking-wider">
              Arsitektur Verifikasi
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B3D2E] tracking-tight mt-1">
              Empat Lapisan Verifikasi Aliran Sampah
            </h2>
            <p className="text-sm text-[#667085] mt-2">
              Setiap kilogram material dilacak dari timbangan masuk hingga serah terima pertama (first-hop).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="bg-white rounded-xl p-5 border border-[#E4E7EC] shadow-2xs space-y-3">
              <div className="w-9 h-9 rounded-lg bg-[#DDF4EA] flex items-center justify-center text-[#0B3D2E] font-bold text-sm">
                01
              </div>
              <h3 className="text-base font-bold text-[#101828]">Input Timbangan & Foto</h3>
              <p className="text-xs text-[#667085] leading-relaxed">
                Massa masuk total (M_in) ditimbang dan difoto langsung lewat kamera ponsel petugas dengan kode batch unik 6 karakter serta QR code.
              </p>
              <div className="pt-2 text-[11px] font-mono text-[#0F6B4F]">
                Rumus: M_in tercatat di perangkat
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-xl p-5 border border-[#E4E7EC] shadow-2xs space-y-3">
              <div className="w-9 h-9 rounded-lg bg-[#DDF4EA] flex items-center justify-center text-[#0B3D2E] font-bold text-sm">
                02
              </div>
              <h3 className="text-base font-bold text-[#101828]">Pemilahan & Neraca</h3>
              <p className="text-xs text-[#667085] leading-relaxed">
                Pencatatan kategori pilah (Plastik, Kertas, Logam), pengolahan organik tapak (kompos/maggot), residu TPA, serta sisa stok (ΔS).
              </p>
              <div className="pt-2 text-[11px] font-mono text-[#0F6B4F]">
                e = M_in − (M_rec + M_org + M_res + ΔS)
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-xl p-5 border border-[#E4E7EC] shadow-2xs space-y-3">
              <div className="w-9 h-9 rounded-lg bg-[#DDF4EA] flex items-center justify-center text-[#0B3D2E] font-bold text-sm">
                03
              </div>
              <h3 className="text-base font-bold text-[#101828]">Konfirmasi Dua Pihak (Blind)</h3>
              <p className="text-xs text-[#667085] leading-relaxed">
                Pengepul/mitra mengisi berat terima (W'_k) melalui tautan sekali pakai tanpa melihat klaim pengirim terlebih dahulu, mencegah bias jangkar.
              </p>
              <div className="pt-2 text-[11px] font-mono text-[#0F6B4F]">
                d_k = |W_k − W'_k| / W_k ≤ τ_d
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-white rounded-xl p-5 border border-[#E4E7EC] shadow-2xs space-y-3">
              <div className="w-9 h-9 rounded-lg bg-[#DDF4EA] flex items-center justify-center text-[#0B3D2E] font-bold text-sm">
                04
              </div>
              <h3 className="text-base font-bold text-[#101828]">Audit Trail Berantai Hash</h3>
              <p className="text-xs text-[#667085] leading-relaxed">
                Setiap mutasi data dibubuhi SHA-256 berantai per fasilitas. Angka akhir VRR dihitung dan dibekukan dalam snapshot periodik anti-tamper.
              </p>
              <div className="pt-2 text-[11px] font-mono text-[#0F6B4F]">
                VRR = Σ W'_k (terverifikasi) / Σ M_in
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Scientific Principles Section */}
      <section className="py-16 bg-white border-b border-[#E4E7EC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <span className="text-xs font-bold text-[#0F6B4F] uppercase tracking-wider">
                Integritas Ilmiah & Batasan
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B3D2E] tracking-tight">
                Dirancang untuk Keputusan Lapangan, Bukan Klaim Bombastis
              </h2>
              <p className="text-sm text-[#667085] leading-relaxed">
                Sesuai prinsip kehati-hatian dalam Dokumen Induk SIRKULA:
              </p>

              <ul className="space-y-3 pt-2 text-xs sm:text-sm text-[#344054]">
                <li className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-[#0F6B4F] shrink-0 mt-0.5" />
                  <span>
                    <strong>Bahasa Netral:</strong> Tidak menuduh kecurangan. Istilah yang dipakai di sistem adalah <em>"perlu dicek"</em>, <em>"tidak konsisten"</em>, atau <em>"belum terverifikasi"</em>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-[#0F6B4F] shrink-0 mt-0.5" />
                  <span>
                    <strong>Statistik Kuat Tanpa Black-Box:</strong> Deteksi anomali R1–R7 memakai median, MAD (Median Absolute Deviation), dan toleransi terkalibrasi yang dapat dijelaskan ke petugas.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-[#0F6B4F] shrink-0 mt-0.5" />
                  <span>
                    <strong>Batasan First-Hop:</strong> Verifikasi menjamin serah terima fisik pertama ke pengepul/pengolah terdaftar; tidak mengklaim proses industri daur ulang lanjutan di luar gerbang mitra.
                  </span>
                </li>
              </ul>

              <div className="pt-4">
                <button
                  onClick={() => onNavigate('metode')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F6B4F] hover:text-[#0B3D2E] underline"
                >
                  <span>Baca Spesifikasi Metode Lengkap (LKTIN PWT XIV)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick Demonstration of Anomaly Reason Generation */}
            <div className="lg:col-span-6">
              <div className="bg-[#F8FAF9] rounded-2xl border border-[#E4E7EC] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-[#101828]">Contoh Penjelasan Anomali Otomatis</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#667085]">Aturan R1 & R3</span>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-white border border-[#E4E7EC] text-xs">
                    <div className="flex items-center justify-between text-[#667085] mb-1 font-medium">
                      <span>Batch B-3P4Q · TPS3R Mulyo Asri</span>
                      <span className="text-rose-600 font-bold">R1: Closure Error</span>
                    </div>
                    <p className="text-[#101828] font-medium leading-relaxed">
                      "Selisih penutupan batch 9,2% (16,5 kg dari 180,0 kg) berada di luar rentang wajar untuk kategori dominan Plastik (skor z 3,82, batas 3,50). Ambang v1, beku."
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white border border-[#E4E7EC] text-xs">
                    <div className="flex items-center justify-between text-[#667085] mb-1 font-medium">
                      <span>Pengiriman SHP-003 · UD Berkah Plastik</span>
                      <span className="text-amber-600 font-bold">R3: Selisih Dua Pihak</span>
                    </div>
                    <p className="text-[#101828] font-medium leading-relaxed">
                      "Berat kirim 69,0 kg berbeda 7,2% dari berat terima 64,0 kg. Batas toleransi selisih 5,0%."
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-[#667085]">
                  Setiap tanda anomali menyediakan form peninjauan alasan (kadar air, susut timbang, kesalahan input) dengan prinsip pengawasan dua mata.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E4E7EC] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              <span className="text-xs text-[#667085]">
                Inisiatif Riset & Rekayasa Verifikasi Aliran Sampah TPS3R.
              </span>
            </div>

            <div className="flex items-center gap-6 text-xs text-[#667085]">
              <button
                onClick={() => onNavigate('metode')}
                className="hover:text-[#101828] transition-colors cursor-pointer"
              >
                Metodologi
              </button>
              <button
                onClick={() => onNavigate('privasi')}
                className="hover:text-[#101828] transition-colors cursor-pointer"
              >
                Kebijakan Privasi
              </button>
              <button
                onClick={() => onNavigate('syarat')}
                className="hover:text-[#101828] transition-colors cursor-pointer"
              >
                Syarat Penggunaan
              </button>
              <button
                onClick={() => onNavigate('verifikasi')}
                className="hover:text-[#101828] transition-colors cursor-pointer"
              >
                Verifikasi Laporan
              </button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#E4E7EC] text-center text-xs text-[#667085]">
            <p>
              SIRKULA bukan pengganti audit tera timbangan metrologi resmi atau peradilan hukum.
              Data diverifikasi secara kriptografis hingga serah terima pertama (first-hop).
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
