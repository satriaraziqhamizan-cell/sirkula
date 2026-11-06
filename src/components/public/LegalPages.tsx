import React from 'react';
import { ArrowLeft, ShieldCheck, FileText } from 'lucide-react';

interface LegalPageProps {
  type: 'privasi' | 'syarat';
  onBack: () => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({ type, onBack }) => {
  const isPrivasi = type === 'privasi';

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-[#0F6B4F] hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>

        <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 sm:p-10 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[#E4E7EC]">
            <div className="w-10 h-10 rounded-xl bg-[#DDF4EA] text-[#0B3D2E] flex items-center justify-center">
              {isPrivasi ? <ShieldCheck className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#101828]">
                {isPrivasi ? 'Kebijakan Privasi SIRKULA' : 'Syarat & Ketentuan Penggunaan'}
              </h1>
              <p className="text-xs text-[#667085] mt-0.5">
                Versi 1.0 — Berlaku sejak 4 November 2026 (Sesuai UU PDP No. 27/2022)
              </p>
            </div>
          </div>

          {isPrivasi ? (
            <div className="space-y-4 text-xs sm:text-sm text-[#344054] leading-relaxed">
              <h3 className="text-base font-bold text-[#101828]">1. Prinsip Minimalisasi Data</h3>
              <p>
                Aplikasi SIRKULA dirancang dengan prinsip pelindungan data pribadi yang ketat:
                kami hanya mengumpulkan data operasional pengelolaan sampah (berat timbangan, kategori material, waktu dan lokasi fasilitas).
                Petugas lapangan dicatat dengan nama pseudonim (contoh: <em>Petugas-01</em>) di seluruh laporan publik dan ekspor dinas.
              </p>

              <h3 className="text-base font-bold text-[#101828]">2. Pengambilan &amp; Retensi Foto Bukti</h3>
              <p>
                Kamera aplikasi difokuskan pada angka timbangan dan tumpukan material. Petugas diinstruksikan tidak memuat wajah orang dalam foto bukti.
                Foto bukti disimpan dalam bucket privat terenkripsi dan dihapus otomatis setelah 12 bulan sesuai jadwal retensi.
              </p>

              <h3 className="text-base font-bold text-[#101828]">3. Hak Akses &amp; Audit Trail</h3>
              <p>
                Seluruh aktivitas mutasi data dicatat pada log kejadian berantai hash (SHA-256) per fasilitas.
                Data tidak diperjualbelikan kepada pihak ketiga komersial manapun dan hanya dipergunakan untuk keperluan pemantauan dinas lingkungan hidup dan penelitian ilmiah terakreditasi.
              </p>
            </div>
          ) : (
            <div className="space-y-4 text-xs sm:text-sm text-[#344054] leading-relaxed">
              <h3 className="text-base font-bold text-[#101828]">1. Tanggung Jawab Keakuratan Masukan</h3>
              <p>
                Petugas dan pengelola fasilitas bertanggung jawab penuh atas kebenaran input timbangan awal.
                Perubahan data setelah batch ditutup wajib melalui prosedur koreksi resmi dengan alasan terdokumentasi.
              </p>

              <h3 className="text-base font-bold text-[#101828]">2. Batas Verifikasi First-Hop</h3>
              <p>
                Pengguna memahami bahwa status "Terverifikasi" (VRR) menjamin keabsahan fisik serah terima material kepada pihak penerima (pengepul/industri) yang terdaftar.
                SIRKULA tidak menjamin rantai pengolahan lanjutan setelah pintu gerbang penerima pertama.
              </p>

              <h3 className="text-base font-bold text-[#101828]">3. Sifat Deteksi Anomali</h3>
              <p>
                Indikator anomali (R1–R7) merupakan alat bantu audit statistik kuantitatif untuk menemukan inkonsistensi data fisik, bukan pembuktian pelanggaran hukum atau kecurangan perdata/pidana.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
