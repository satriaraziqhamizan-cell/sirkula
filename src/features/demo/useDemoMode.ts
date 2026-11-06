import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { applyOp } from '../shared/applyOp';

export function useDemoMode() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const isDemoEnv = import.meta.env.VITE_APP_ENV === 'demo';

  const isDemoMode = useMemo(() => {
    if (isDemoEnv) return true;
    // Check if user belongs to demo tenant
    if (profile?.username?.toLowerCase().includes('demo')) return true;
    return false;
  }, [isDemoEnv, profile]);

  const resetDemoMutation = useMutation({
    mutationFn: async () => {
      if (profile?.role !== 'admin') {
        throw new Error('Hanya administrator yang berhak mereset data contoh demo.');
      }

      await applyOp({
        op_type: 'demo.reset',
        payload: {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  return {
    isDemoMode,
    canResetDemo: profile?.role === 'admin',
    resetDemoData: resetDemoMutation.mutateAsync,
    isResetting: resetDemoMutation.isPending,
  };
}
