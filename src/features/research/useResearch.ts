import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ReferenceWeighing, SUSResponse } from '../../types';
import { applyOp } from '../shared/applyOp';

export function useResearch(facilityId?: string | null) {
  const queryClient = useQueryClient();

  // 1. Reference Weighings
  const { data: refWeighings = [], isLoading: isLoadingRef } = useQuery<ReferenceWeighing[]>({
    queryKey: ['reference_weighings', facilityId || 'all'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return [];

      let query = supabase
        .from('reference_weighings')
        .select('*')
        .order('weighed_at', { ascending: false });

      if (facilityId) {
        query = query.eq('facility_id', facilityId);
      }

      const { data, error: err } = await query;
      if (err) {
        console.warn('Gagal memuat timbangan referensi:', err.message);
        return [];
      }

      return (data || []).map((rw: any) => {
        const diff = Number((rw.facility_scale_kg - rw.reference_scale_kg).toFixed(3));
        const relDiff = rw.reference_scale_kg > 0 ? Number((diff / rw.reference_scale_kg).toFixed(4)) : 0;
        return {
          ...rw,
          diff_kg: diff,
          rel_diff: relDiff,
        };
      }) as ReferenceWeighing[];
    },
  });

  // 2. SUS Responses
  const { data: susResponses = [], isLoading: isLoadingSus } = useQuery<SUSResponse[]>({
    queryKey: ['sus_responses'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return [];

      const { data, error: err } = await supabase
        .from('sus_responses')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) {
        console.warn('Gagal memuat respon SUS:', err.message);
        return [];
      }

      return (data || []) as SUSResponse[];
    },
  });

  // Add Reference Weighing Mutation
  const addWeighingMutation = useMutation({
    mutationFn: async (payload: {
      facility_id: string;
      batch_id?: string;
      facility_scale_kg: number;
      reference_scale_kg: number;
    }) => {
      await applyOp({
        op_type: 'research.weighing_create',
        facility_id: payload.facility_id,
        payload: {
          batch_id: payload.batch_id || null,
          facility_scale_kg: payload.facility_scale_kg,
          reference_scale_kg: payload.reference_scale_kg,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference_weighings'] });
    },
  });

  // Submit SUS Mutation
  const submitSusMutation = useMutation({
    mutationFn: async (payload: {
      participant_code: string;
      role: string;
      answers: number[];
      score: number;
      consent: boolean;
    }) => {
      await applyOp({
        op_type: 'research.sus_submit',
        payload: {
          participant_code: payload.participant_code,
          role: payload.role,
          answers: payload.answers,
          score: payload.score,
          consent: payload.consent,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sus_responses'] });
    },
  });

  return {
    refWeighings,
    susResponses,
    isLoading: isLoadingRef || isLoadingSus,
    addWeighing: addWeighingMutation.mutateAsync,
    submitSus: submitSusMutation.mutateAsync,
  };
}
