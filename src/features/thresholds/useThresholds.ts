import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ThresholdSet } from '../../types';
import { applyOp } from '../shared/applyOp';

export function useThresholds(facilityId?: string | null) {
  const queryClient = useQueryClient();

  const { data: thresholdSets = [], isLoading, error, refetch } = useQuery<ThresholdSet[]>({
    queryKey: ['threshold_sets', facilityId || 'all'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return [];

      let query = supabase
        .from('threshold_sets')
        .select('*')
        .order('version', { ascending: false });

      if (facilityId) {
        query = query.or(`facility_id.eq.${facilityId},facility_id.is.null`);
      }

      const { data, error: err } = await query;
      if (err) {
        console.warn('Gagal memuat threshold sets:', err.message);
        return [];
      }

      return (data || []) as ThresholdSet[];
    },
  });

  const freezeThresholdMutation = useMutation({
    mutationFn: async (payload: { threshold_id: string; facility_id?: string; note?: string }) => {
      await applyOp({
        op_type: 'threshold.freeze',
        facility_id: payload.facility_id,
        payload: {
          threshold_id: payload.threshold_id,
          note: payload.note || 'Dibekukan oleh pengelola/admin fasilitas.',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threshold_sets'] });
    },
  });

  return {
    thresholdSets,
    isLoading,
    error,
    refetch,
    freezeThreshold: freezeThresholdMutation.mutateAsync,
    isFreezing: freezeThresholdMutation.isPending,
  };
}
