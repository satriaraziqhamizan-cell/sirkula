import React, { useState } from 'react';
import { useAuth } from './useAuth';
import { Logo } from '../../components/Logo';
import { Lock, User, AlertCircle, ArrowRight, KeyRound, Wifi, WifiOff } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isSupabaseConfigured } from '../../lib/supabase';

export const LoginPage: React.FC = () => {
  const { signIn, updatePassword, mustChangePassword, error, isLoading } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setLocalError('Layanan belum dikonfigurasi. Hubungi administrator.');
      return;
    }
    setLocalError(null);
    if (!identifier.trim() || !password) {
      setLocalError('Mohon isi nama pengguna / email dan kata sandi.');
      return;
    }

    const res = await signIn(identifier, password);
    if (res.ok) {
      if (!mustChangePassword) {
        navigate(from, { replace: true });
      }
    } else {
      setLocalError(res.error || 'Login gagal.');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (newPassword.length < 10) {
      setLocalError('Kata sandi baru minimal 10 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    const res = await updatePassword(newPassword);
    if (res.ok) {
      navigate(from, { replace: true });
    } else {
      setLocalError(res.error || 'Gagal mengubah kata sandi.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-4">
          <Logo size="lg" />
        </div>
        <h2 className="text-2xl font-extrabold text-[#0B3D2E] tracking-tight">
          {mustChangePassword ? 'Wajib Ganti Kata Sandi Pertama' : 'Masuk ke Portal SIRKULA'}
        </h2>
        <p className="mt-1 text-xs text-[#667085]">
          {mustChangePassword
            ? 'Untuk keamanan data fasilitas, ganti kata sandi awal Anda (min 10 karakter).'
            : 'Sistem Verifikasi Aliran Sampah Berbasis Neraca Massa TPS3R'}
        </p>

        {/* Small status line for Supabase connection */}
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium">
          {isSupabaseConfigured ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              <Wifi className="w-3 h-3 text-emerald-600" />
              Terhubung ke Supabase
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              <WifiOff className="w-3 h-3 text-amber-600" />
              Belum terhubung
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-[#E4E7EC] sm:rounded-2xl space-y-6">
          {!isSupabaseConfigured && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Layanan belum dikonfigurasi</span>
              </div>
              <p className="text-[11px] text-amber-800 pl-6">
                Kredensial Supabase (VITE_SUPABASE_URL &amp; VITE_SUPABASE_ANON_KEY) belum diatur di lingkungan sistem. Autentikasi ditangguhkan hingga konfigurasi selesai.
              </p>
            </div>
          )}

          {(localError || error) && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{localError || error}</span>
            </div>
          )}

          {mustChangePassword ? (
            <form onSubmit={handlePasswordChange} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#344054] block mb-1">Kata Sandi Baru (Min. 10 Karakter)</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#667085] absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-[#E4E7EC] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]"
                    placeholder="Minimal 10 karakter..."
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#344054] block mb-1">Ulangi Kata Sandi Baru</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#667085] absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-[#E4E7EC] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]"
                    placeholder="Ketik ulang kata sandi..."
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-[#0F6B4F] hover:bg-[#0B3D2E] text-white font-bold rounded-xl transition-colors cursor-pointer text-xs"
              >
                Simpan Kata Sandi &amp; Masuk
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#344054] block mb-1">
                  Nama Pengguna (Username) atau Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#667085] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    disabled={!isSupabaseConfigured || isLoading}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="petugas1 atau email@instansi.id"
                    className="w-full pl-9 pr-3 py-2 border border-[#E4E7EC] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0F6B4F] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#344054] block mb-1">Kata Sandi</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#667085] absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    disabled={!isSupabaseConfigured || isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="w-full pl-9 pr-3 py-2 border border-[#E4E7EC] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0F6B4F] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!isSupabaseConfigured || isLoading}
                className="w-full py-2.5 bg-[#0F6B4F] hover:bg-[#0B3D2E] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <span>
                  {!isSupabaseConfigured
                    ? 'Layanan Belum Dikonfigurasi'
                    : isLoading
                    ? 'Memeriksa Kredensial...'
                    : 'Masuk ke Sistem'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Policy note */}
          <div className="pt-3 border-t border-[#E4E7EC] text-center text-[11px] text-[#667085] space-y-2">
            <p>
              <strong>Tanpa Pendaftaran Mandiri:</strong> Akun diterbitkan langsung oleh Pengelola TPS3R atau Dinas Lingkungan Hidup sesuai Aturan Wajib 0.11.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

