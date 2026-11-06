import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Anomaly } from '../../types';
import { applyOp } from '../shared/applyOp';

export function useAnomalies(facilityId?: string | null) {
  const queryClient = useQueryClient();

  const {
    data: anomalies = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Anomaly[]>({
    queryKey: ['anomalies', facilityId || 'all'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return [];

      let query = supabase
        .from('anomalies')
        .select('*')
        .order('created_at', { ascending: false });

      if (facilityId) {
        query = query.eq('facility_id', facilityId);
      }

      const { data, error: err } = await query;
      if (err) {
        console.warn('Gagal memuat anomali:', err.message);
        return [];
      }

      return (data || []) as Anomaly[];
    },
  });

  const reviewAnomalyMutation = useMutation({
    mutationFn: async (payload: {
      anomaly_id: string;
      facility_id: string;
      status: 'open' | 'dikoreksi' | 'dijelaskan' | 'tidak_terjelaskan';
      cause?: string;
      review_note?: string;
    }) => {
      await applyOp({
        op_type: 'anomaly.review',
        facility_id: payload.facility_id,
        payload: {
          anomaly_id: payload.anomaly_id,
          status: payload.status,
          cause: payload.cause || null,
          review_note: payload.review_note || '',
        },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['anomalies', variables.facility_id] });
      queryClient.invalidateQueries({ queryKey: ['anomalies', 'all'] });
    },
  });

  return {
    anomalies,
    isLoading,
    error,
    refetch,
    reviewAnomaly: reviewAnomalyMutation.mutateAsync,
    isReviewing: reviewAnomalyMutation.isPending,
  };
}
