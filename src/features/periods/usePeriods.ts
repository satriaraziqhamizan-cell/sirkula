import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { PeriodReport } from '../../types';
import { applyOp } from '../shared/applyOp';

export function usePeriods(facilityId?: string | null, publicOnly: boolean = false) {
  const queryClient = useQueryClient();

  const {
    data: reports = [],
    isLoading,
    error,
    refetch,
  } = useQuery<PeriodReport[]>({
    queryKey: ['period_reports', facilityId || 'all', publicOnly ? 'public' : 'all'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return [];

      let query = supabase
        .from('period_reports')
        .select('*')
        .order('period_end', { ascending: false });

      if (facilityId) {
        query = query.eq('facility_id', facilityId);
      }

      if (publicOnly) {
        query = query.eq('status', 'closed');
      }

      const { data, error: err } = await query;
      if (err) {
        console.warn('Gagal memuat laporan periode:', err.message);
        return [];
      }

      return (data || []) as PeriodReport[];
    },
  });

  const closePeriodMutation = useMutation({
    mutationFn: async (payload: {
      facility_id: string;
      period_start: string;
      period_end: string;
      total_in_kg: number;
      verified_kg: number;
      verified_p_kg: number;
      reported_recycled_kg: number;
      rr: number | null;
      vrr: number | null;
      vrr_p: number | null;
      gap: number | null;
      coverage: any;
      blockers: any;
      threshold_set_id?: string;
      snapshot_hash?: string;
    }) => {
      await applyOp({
        op_type: 'period.close',
        facility_id: payload.facility_id,
        payload: {
          period_start: payload.period_start,
          period_end: payload.period_end,
          total_in_kg: payload.total_in_kg,
          verified_kg: payload.verified_kg,
          verified_p_kg: payload.verified_p_kg,
          reported_recycled_kg: payload.reported_recycled_kg,
          rr: payload.rr,
          vrr: payload.vrr,
          vrr_p: payload.vrr_p,
          gap: payload.gap,
          coverage: payload.coverage,
          blockers: payload.blockers,
          threshold_set_id: payload.threshold_set_id,
          engine_version: '1.0.0',
          snapshot_hash: payload.snapshot_hash || crypto.randomUUID().replace(/-/g, ''),
        },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['period_reports', variables.facility_id] });
      queryClient.invalidateQueries({ queryKey: ['period_reports', 'all'] });
    },
  });

  return {
    reports,
    isLoading,
    error,
    refetch,
    closePeriod: closePeriodMutation.mutateAsync,
    isClosing: closePeriodMutation.isPending,
  };
}
