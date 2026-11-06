import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Header } from './components/Header';
import { useAuth } from './features/auth/useAuth';
import { RequireRole } from './features/auth/RequireRole';
import { LoginPage } from './features/auth/LoginPage';
import { LandingPage } from './components/public/LandingPage';
import { MetodePage } from './components/public/MetodePage';
import { VerifikasiPage } from './components/public/VerifikasiPage';
import { RecipientConfirmPage } from './components/public/RecipientConfirmPage';
import { LegalPage } from './components/public/LegalPages';
import { SyncStatusPage } from './components/public/SyncStatusPage';

// Code-split per role with React.lazy
const PetugasConsole = lazy(() =>
  import('./components/petugas/PetugasConsole').then((m) => ({ default: m.PetugasConsole }))
);
const PengelolaConsole = lazy(() =>
  import('./components/pengelola/PengelolaConsole').then((m) => ({ default: m.PengelolaConsole }))
);
const DinasDashboard = lazy(() =>
  import('./components/dinas/DinasDashboard').then((m) => ({ default: m.DinasDashboard }))
);
const ResearchCenter = lazy(() =>
  import('./components/research/ResearchCenter').then((m) => ({ default: m.ResearchCenter }))
);

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="text-center space-y-3">
      <div className="w-8 h-8 border-3 border-[#0F6B4F] border-t-transparent rounded-full animate-spin mx-auto" />
      <span className="text-xs text-[#667085] font-semibold">Memuat modul antarmuka...</span>
    </div>
  </div>
);

export default function App() {
  const { initAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAF9] text-[#101828]">
      {/* Top Header - with navigator.onLine and Demo Banner */}
      <Header />

      {/* Main View Router */}
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/masuk" element={<LoginPage />} />
            <Route path="/metode" element={<MetodePage onBack={() => navigate('/')} />} />
            <Route path="/verifikasi" element={<VerifikasiPage onBack={() => navigate('/')} />} />
            <Route path="/verifikasi/:reportId" element={<VerifikasiPage onBack={() => navigate('/')} />} />
            <Route path="/k/:token" element={<RecipientConfirmPage onBack={() => navigate('/')} />} />
            <Route path="/k" element={<RecipientConfirmPage onBack={() => navigate('/')} />} />
            <Route path="/privasi" element={<LegalPage type="privasi" onBack={() => navigate('/')} />} />
            <Route path="/syarat" element={<LegalPage type="syarat" onBack={() => navigate('/')} />} />
            <Route path="/app/sinkron" element={<SyncStatusPage />} />
            <Route path="/sinkron" element={<SyncStatusPage />} />

            {/* Protected Role-Based Routes (Components fetch their own data via hooks) */}
            <Route
              path="/petugas"
              element={
                <RequireRole allowedRoles={['petugas_tps3r', 'pengelola', 'admin']}>
                  <PetugasConsole />
                </RequireRole>
              }
            />

            <Route
              path="/kelola"
              element={
                <RequireRole allowedRoles={['pengelola', 'admin']}>
                  <PengelolaConsole onNavigateToPublicVerification={(repId) => navigate(`/verifikasi/${repId}`)} />
                </RequireRole>
              }
            />

            <Route
              path="/dinas"
              element={
                <RequireRole allowedRoles={['dinas', 'admin']}>
                  <DinasDashboard onNavigateToPublicVerification={(repId) => navigate(`/verifikasi/${repId}`)} />
                </RequireRole>
              }
            />

            <Route
              path="/admin/riset"
              element={
                <RequireRole allowedRoles={['admin', 'pengelola']}>
                  <ResearchCenter />
                </RequireRole>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
