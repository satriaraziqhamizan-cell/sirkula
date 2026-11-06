import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Batch } from '../../types';
import { applyOp } from '../shared/applyOp';
import { balance } from '../../engine';

export function useBatches(facilityId: string | null) {
  const queryClient = useQueryClient();

  const {
    data: batches = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Batch[]>({
    queryKey: ['batches', facilityId],
    queryFn: async () => {
      if (!isSupabaseConfigured || !facilityId) return [];

      const { data: batchRows, error: batchErr } = await supabase
        .from('batches')
        .select(`
          *,
          items:batch_items(*),
          onsite:onsite_processing(*)
        `)
        .eq('facility_id', facilityId)
        .order('received_at', { ascending: false });

      if (batchErr) {
        console.warn('Gagal memuat batch:', batchErr.message);
        return [];
      }

      return (batchRows || []) as Batch[];
    },
    enabled: Boolean(facilityId),
  });

  // Create Batch Mutation
  const createBatchMutation = useMutation({
    mutationFn: async (payload: {
      code?: string;
      source_type: string;
      source_name?: string;
      weight_in_total_kg: number;
      weigh_photo_path?: string;
      received_at?: string;
      items?: Array<{ category_id: string; weight_sorted_kg: number }>;
      onsite?: Array<{ method: string; weight_kg: number }>;
    }) => {
      if (!facilityId) throw new Error('Fasilitas aktif tidak ditentukan.');
      const batchId = crypto.randomUUID();
      const code = payload.code || `B-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      await applyOp({
        op_type: 'batch.create',
        facility_id: facilityId,
        payload: {
          id: batchId,
          code,
          source_type: payload.source_type,
          source_name: payload.source_name || '',
          weight_in_total_kg: payload.weight_in_total_kg,
          weigh_photo_path: payload.weigh_photo_path || '',
          received_at: payload.received_at || new Date().toISOString(),
          items: payload.items || [],
          onsite: payload.onsite || [],
        },
      });

      return { id: batchId, code };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', facilityId] });
    },
  });

  // Close Batch Mutation with remaining stock Delta_S
  const closeBatchMutation = useMutation({
    mutationFn: async (payload: {
      batch_id: string;
      remaining_stock_kg: number;
      mIn: number;
      mRec: number;
      mOrg: number;
      mRes: number;
    }) => {
      if (!facilityId) throw new Error('Fasilitas aktif tidak ditentukan.');
      if (payload.remaining_stock_kg === undefined || payload.remaining_stock_kg < 0) {
        throw new Error('Stok sisa (ΔS) wajib diisi dengan nilai non-negatif.');
      }

      const bal = balance({
        mIn: payload.mIn,
        mRec: payload.mRec,
        mOrg: payload.mOrg,
        mRes: payload.mRes,
        deltaS: payload.remaining_stock_kg,
      });

      const isNegativeAnomaly = (bal.eRel ?? 0) < -0.02;

      await applyOp({
        op_type: 'batch.close',
        facility_id: facilityId,
        payload: {
          batch_id: payload.batch_id,
          remaining_stock_kg: payload.remaining_stock_kg,
          e_kg: bal.e,
          e_rel: bal.eRel,
          balance_status: isNegativeAnomaly ? 'ditandai' : 'lolos',
          needs_review: isNegativeAnomaly,
          closed_at: new Date().toISOString(),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', facilityId] });
      queryClient.invalidateQueries({ queryKey: ['anomalies', facilityId] });
    },
  });

  // Correct Batch Mutation (Reason is strictly mandatory!)
  const correctBatchMutation = useMutation({
    mutationFn: async (payload: {
      batch_id: string;
      weight_in_total_kg: number;
      reason: string;
    }) => {
      if (!facilityId) throw new Error('Fasilitas aktif tidak ditentukan.');
      if (!payload.reason || !payload.reason.trim()) {
        throw new Error('Alasan koreksi bobot wajib diisi sesuai Aturan Wajib 0.1.');
      }

      await applyOp({
        op_type: 'batch.correct',
        facility_id: facilityId,
        payload: {
          batch_id: payload.batch_id,
          weight_in_total_kg: payload.weight_in_total_kg,
          reason: payload.reason.trim(),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', facilityId] });
      queryClient.invalidateQueries({ queryKey: ['event_log', facilityId] });
    },
  });

  // Void Batch Mutation (Reason is strictly mandatory!)
  const voidBatchMutation = useMutation({
    mutationFn: async (payload: {
      batch_id: string;
      void_reason: string;
    }) => {
      if (!facilityId) throw new Error('Fasilitas aktif tidak ditentukan.');
      if (!payload.void_reason || !payload.void_reason.trim()) {
        throw new Error('Alasan pembatalan (void) wajib diisi.');
      }

      await applyOp({
        op_type: 'batch.void',
        facility_id: facilityId,
        payload: {
          batch_id: payload.batch_id,
          void_reason: payload.void_reason.trim(),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', facilityId] });
      queryClient.invalidateQueries({ queryKey: ['event_log', facilityId] });
    },
  });

  return {
    batches,
    isLoading,
    error,
    refetch,
    createBatch: createBatchMutation.mutateAsync,
    isCreating: createBatchMutation.isPending,
    closeBatch: closeBatchMutation.mutateAsync,
    isClosing: closeBatchMutation.isPending,
    correctBatch: correctBatchMutation.mutateAsync,
    isCorrecting: correctBatchMutation.isPending,
    voidBatch: voidBatchMutation.mutateAsync,
    isVoiding: voidBatchMutation.isPending,
  };
}
