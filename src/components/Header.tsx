import React, { useState, useEffect } from 'react';
import { Logo } from './Logo';
import { useAuth } from '../features/auth/useAuth';
import { UserRole } from '../types';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useDemoMode } from '../features/demo/useDemoMode';
import { syncManager } from '../lib/sync';
import {
  WifiOff,
  LogOut,
  LogIn,
  Menu,
  X,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export const Header: React.FC = () => {
  const { profile, signOut } = useAuth();
  const { isDemoMode, canResetDemo, resetDemoData, isResetting } = useDemoMode();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncState, setSyncState] = useState({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
    needsReviewCount: 0,
  });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = syncManager.subscribe((st) => {
      setSyncState(st);
      setIsOnline(st.isOnline);
    });
    return () => unsub();
  }, []);

  const roleLabels: Record<UserRole, { label: string; badge: string }> = {
    petugas_tps3r: { label: 'Petugas Timbang & Pilah', badge: 'bg-[#DDF4EA] text-[#0B3D2E]' },
    petugas_angkut: { label: 'Petugas Angkut', badge: 'bg-blue-50 text-blue-700' },
    pengelola: { label: 'Pengelola TPS3R', badge: 'bg-emerald-50 text-emerald-800' },
    dinas: { label: 'Staf Dinas LH', badge: 'bg-purple-50 text-purple-800' },
    admin: { label: 'Tim Peneliti & Admin', badge: 'bg-amber-50 text-amber-800' },
  };

  const navItems = [
    { to: '/', label: 'Beranda' },
    { to: '/petugas', label: 'Pencatatan Petugas', roles: ['petugas_tps3r', 'pengelola', 'admin'] },
    { to: '/kelola', label: 'Manajemen TPS3R', roles: ['pengelola', 'admin'] },
    { to: '/dinas', label: 'Dasbor Dinas', roles: ['dinas', 'admin'] },
    { to: '/admin/riset', label: 'Riset & Audit', roles: ['admin', 'pengelola'] },
    { to: '/metode', label: 'Metode Ilmiah' },
    { to: '/verifikasi', label: 'Cek Laporan' },
  ];

  const visibleNavs = navItems.filter(
    (item) => !item.roles || (profile && item.roles.includes(profile.role))
  );

  const handleLogout = async () => {
    await signOut();
    navigate('/masuk');
  };

  const handleResetDemo = async () => {
    try {
      await resetDemoData();
      setShowResetConfirm(false);
    } catch (e: any) {
      alert(e.message || 'Gagal mereset data demo.');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E4E7EC] shadow-2xs">
      {/* 1. Yellow Banner for DEMO MODE */}
      {isDemoMode && (
        <div className="bg-amber-400 text-amber-950 px-4 py-1.5 text-xs font-bold flex items-center justify-between border-b border-amber-500 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 bg-amber-900 text-amber-100 rounded text-[10px] tracking-wider uppercase font-black">
              DATA CONTOH
            </span>
            <span>Anda sedang berada di lingkungan simulasi dengan data contoh.</span>
          </div>

          {canResetDemo && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={isResetting}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-950/10 hover:bg-amber-950/20 text-amber-950 rounded text-[11px] font-bold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isResetting ? 'Mereset...' : 'Reset Data Contoh'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Real Offline Banner (navigator.onLine) */}
      {!isOnline && (
        <div className="bg-rose-600 text-white text-xs font-semibold px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Perangkat Anda saat ini tidak terhubung ke jaringan internet.</span>
          </div>
          <span className="text-[11px] font-mono text-rose-100">Koneksi Terputus</span>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-amber-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">Konfirmasi Reset Data Demo</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tindakan ini hanya akan menghapus baris transaksi dengan penanda <code>is_demo = true</code>. Data operasional produksi resmi tidak akan terpengaruh.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleResetDemo}
                disabled={isResetting}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
              >
                {isResetting ? 'Mereset...' : 'Ya, Reset Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Zone */}
          <div className="flex items-center gap-4 shrink-0">
            <Link to="/" className="text-left cursor-pointer focus:outline-none">
              <Logo size="md" />
            </Link>
          </div>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
            {visibleNavs.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs xl:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#DDF4EA] text-[#0B3D2E]'
                      : 'text-[#667085] hover:text-[#101828] hover:bg-[#F8FAF9]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Profile & Auth Zone */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Real Offline/Sync Status Indicator */}
            <Link
              to="/app/sinkron"
              title="Status Sinkronisasi Offline"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                !syncState.isOnline
                  ? 'bg-slate-100 text-[#667085] border-slate-300 hover:bg-slate-200'
                  : syncState.needsReviewCount > 0 || syncState.failedCount > 0
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  : syncState.pendingCount > 0
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  : 'bg-emerald-50 text-[#0F6B4F] border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  !syncState.isOnline
                    ? 'bg-slate-400'
                    : syncState.needsReviewCount > 0 || syncState.failedCount > 0
                    ? 'bg-rose-500'
                    : syncState.pendingCount > 0
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-[#0F6B4F]'
                }`}
              />
              <span className="hidden sm:inline">
                {!syncState.isOnline
                  ? 'Offline'
                  : syncState.needsReviewCount > 0
                  ? `${syncState.needsReviewCount} Perlu Tinjauan`
                  : syncState.pendingCount > 0
                  ? `${syncState.pendingCount} Menunggu`
                  : 'Tersinkron'}
              </span>
            </Link>
            {profile ? (
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-lg border border-[#E4E7EC] bg-white">
                  <div className="w-6 h-6 rounded-full bg-[#DDF4EA] flex items-center justify-center text-[#0B3D2E] text-xs font-bold shrink-0">
                    {profile.display_name.charAt(0)}
                  </div>
                  <div className="hidden md:flex flex-col text-left">
                    <span className="text-xs font-bold text-[#101828] leading-tight truncate max-w-[130px]">
                      {profile.display_name}
                    </span>
                    <span className="text-[10px] text-[#667085] leading-none capitalize">
                      {roleLabels[profile.role]?.label || profile.role.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Keluar dari akun"
                  className="p-2 text-[#667085] hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-[#E4E7EC] transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/masuk"
                className="px-4 py-2 text-xs font-bold text-white bg-[#0F6B4F] hover:bg-[#0B3D2E] rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Masuk</span>
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-[#667085] hover:text-[#101828] hover:bg-[#F8FAF9] cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#E4E7EC] bg-white px-4 py-3 space-y-2">
          {visibleNavs.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2 text-sm font-semibold rounded-lg ${
                  isActive ? 'bg-[#DDF4EA] text-[#0B3D2E]' : 'text-[#667085] hover:bg-[#F8FAF9]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {profile && (
            <div className="pt-2 border-t border-[#E4E7EC]">
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm font-semibold text-rose-600 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar ({profile.username})</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
