import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Partner } from '../../types';
import { applyOp } from '../shared/applyOp';

export function usePartners(facilityId: string | null) {
  const queryClient = useQueryClient();

  const {
    data: partners = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Partner[]>({
    queryKey: ['partners', facilityId],
    queryFn: async () => {
      if (!isSupabaseConfigured || !facilityId) return [];

      const { data, error: err } = await supabase
        .from('partners')
        .select('*')
        .eq('facility_id', facilityId)
        .order('name', { ascending: true });

      if (err) {
        console.warn('Gagal memuat partner:', err.message);
        return [];
      }

      return (data || []) as Partner[];
    },
    enabled: Boolean(facilityId),
  });

  const upsertPartnerMutation = useMutation({
    mutationFn: async (payload: {
      id?: string;
      name: string;
      partner_type: 'pengepul' | 'pengolah' | 'tpa' | 'lainnya';
      phone?: string;
      is_active?: boolean;
    }) => {
      if (!facilityId) throw new Error('Fasilitas aktif tidak ditentukan.');
      if (!payload.name || !payload.name.trim()) {
        throw new Error('Nama mitra wajib diisi.');
      }

      await applyOp({
        op_type: 'partner.upsert',
        facility_id: facilityId,
        payload: {
          id: payload.id,
          name: payload.name.trim(),
          partner_type: payload.partner_type,
          phone: payload.phone || '',
          is_active: payload.is_active ?? true,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners', facilityId] });
    },
  });

  return {
    partners,
    isLoading,
    error,
    refetch,
    upsertPartner: upsertPartnerMutation.mutateAsync,
    isUpserting: upsertPartnerMutation.isPending,
  };
}
