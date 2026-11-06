import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { UserRole } from '../../types';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface RequireRoleProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({ allowedRoles, children }) => {
  const { profile, isLoading, mustChangePassword } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-3 border-[#0F6B4F] border-t-transparent rounded-full animate-spin mx-auto" />
          <span className="text-xs text-[#667085] font-semibold">Memeriksa izin akses...</span>
        </div>
      </div>
    );
  }

  // Not logged in -> redirect to /masuk
  if (!profile) {
    return <Navigate to="/masuk" state={{ from: location }} replace />;
  }

  // Forced password change required
  if (mustChangePassword) {
    return <Navigate to="/masuk" state={{ from: location }} replace />;
  }

  // Role check
  if (!allowedRoles.includes(profile.role)) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E4E7EC] shadow-sm max-w-md text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#101828]">Akses Tidak Diizinkan (403)</h2>
            <p className="text-xs text-[#667085] mt-1 leading-relaxed">
              Peran akun Anda (<strong className="text-[#101828] capitalize">{profile.role.replace('_', ' ')}</strong>) tidak memiliki izin untuk membuka halaman ini sesuai kebijakan RBAC SIRKULA.
            </p>
          </div>
          <button
            onClick={() => window.history.back()}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Kembali ke Halaman Sebelumnya
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
