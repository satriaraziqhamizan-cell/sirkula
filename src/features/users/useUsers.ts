import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { UserProfile } from '../../types';

export function useUsers(facilityId?: string | null) {
  const { data: users = [], isLoading, error, refetch } = useQuery<UserProfile[]>({
    queryKey: ['users', facilityId || 'all'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return [];

      let query = supabase
        .from('profiles')
        .select('*')
        .order('display_name', { ascending: true });

      if (facilityId) {
        query = query.or(`facility_id.eq.${facilityId},facility_id.is.null`);
      }

      const { data, error: err } = await query;
      if (err) {
        console.warn('Gagal memuat pengguna:', err.message);
        return [];
      }

      return (data || []) as UserProfile[];
    },
  });

  return { users, isLoading, error, refetch };
}
