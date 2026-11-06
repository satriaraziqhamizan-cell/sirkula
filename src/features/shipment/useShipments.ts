import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Shipment } from '../../types';
import { applyOp } from '../shared/applyOp';

export function useShipments(facilityId: string | null) {
  const queryClient = useQueryClient();

  const {
    data: shipments = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Shipment[]>({
    queryKey: ['shipments', facilityId],
    queryFn: async () => {
      if (!isSupabaseConfigured || !facilityId) return [];

      const { data: rows, error: err } = await supabase
        .from('shipments')
        .select(`
          *,
          partner:partners(name),
          lines:shipment_lines(*),
          confirmation:confirmations(*)
        `)
        .eq('facility_id', facilityId)
        .order('shipped_at', { ascending: false });

      if (err) {
        console.warn('Gagal memuat shipment:', err.message);
        return [];
      }

      // Map joined fields to Shipment interface
      return (rows || []).map((r: any) => ({
        ...r,
        partner_name: r.partner?.name || 'Mitra',
        confirmation: r.confirmation?.[0] || r.confirmation || null,
        weight_sent_kg: (r.lines || []).reduce((sum: number, l: any) => sum + Number(l.weight_kg || 0), 0),
      })) as Shipment[];
    },
    enabled: Boolean(facilityId),
  });

  // Create Shipment Mutation
  const createShipmentMutation = useMutation({
    mutationFn: async (payload: {
      partner_id: string;
      purpose: 'daur_ulang' | 'organik_olah' | 'residu';
      lines: Array<{ batch_id: string; category_id: string; weight_kg: number }>;
      photo_path?: string;
    }) => {
      if (!facilityId) throw new Error('Fasilitas aktif tidak ditentukan.');
      if (!payload.lines || payload.lines.length === 0) {
        throw new Error('Alokasi batch pada pengiriman wajib diisi (minimal 1 baris).');
      }

      const shipmentId = crypto.randomUUID();

      await applyOp({
        op_type: 'shipment.create',
        facility_id: facilityId,
        payload: {
          id: shipmentId,
          partner_id: payload.partner_id,
          purpose: payload.purpose,
          photo_path: payload.photo_path || '',
          shipped_at: new Date().toISOString(),
          lines: payload.lines,
        },
      });

      return { id: shipmentId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments', facilityId] });
      queryClient.invalidateQueries({ queryKey: ['batches', facilityId] });
    },
  });

  // Void Shipment Mutation
  const voidShipmentMutation = useMutation({
    mutationFn: async (payload: { shipment_id: string; void_reason: string }) => {
      if (!facilityId) throw new Error('Fasilitas aktif tidak ditentukan.');
      if (!payload.void_reason || !payload.void_reason.trim()) {
        throw new Error('Alasan pembatalan (void) pengiriman wajib diisi.');
      }

      await applyOp({
        op_type: 'shipment.void',
        facility_id: facilityId,
        payload: {
          shipment_id: payload.shipment_id,
          void_reason: payload.void_reason.trim(),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments', facilityId] });
      queryClient.invalidateQueries({ queryKey: ['event_log', facilityId] });
    },
  });

  return {
    shipments,
    isLoading,
    error,
    refetch,
    createShipment: createShipmentMutation.mutateAsync,
    isCreating: createShipmentMutation.isPending,
    voidShipment: voidShipmentMutation.mutateAsync,
    isVoiding: voidShipmentMutation.isPending,
  };
}
