import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { EventLogEntry } from '../../types';

export function useAuditLog(facilityId?: string | null) {
  const { data: eventLog = [], isLoading, error, refetch } = useQuery<EventLogEntry[]>({
    queryKey: ['event_log', facilityId || 'all'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return [];

      let query = supabase
        .from('event_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (facilityId) {
        query = query.eq('facility_id', facilityId);
      }

      const { data, error: err } = await query;
      if (err) {
        console.warn('Gagal memuat event log:', err.message);
        return [];
      }

      return (data || []) as EventLogEntry[];
    },
  });

  return { eventLog, isLoading, error, refetch };
}
