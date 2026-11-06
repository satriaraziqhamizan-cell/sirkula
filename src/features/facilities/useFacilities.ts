import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Facility } from '../../types';
import { useAuth } from '../auth/useAuth';

export function useFacilities() {
  const { profile } = useAuth();
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);

  const { data: facilities = [], isLoading, error } = useQuery<Facility[]>({
    queryKey: ['facilities'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('Gagal memuat data fasilitas:', error.message);
        return [];
      }
      return (data || []) as Facility[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Role-based active facility resolution
  const activeFacilityId = useMemo(() => {
    // Petugas & Pengelola strictly pinned to their profile.facility_id
    if (profile?.role === 'petugas_tps3r' || profile?.role === 'pengelola') {
      return profile.facility_id || null;
    }

    // Admin & Dinas can select any facility
    if (selectedFacilityId) {
      return selectedFacilityId;
    }

    // Default to profile facility if assigned, or first available facility
    if (profile?.facility_id) {
      return profile.facility_id;
    }

    return facilities[0]?.id || null;
  }, [profile, selectedFacilityId, facilities]);

  const activeFacility = useMemo(() => {
    return facilities.find((f) => f.id === activeFacilityId) || null;
  }, [facilities, activeFacilityId]);

  return {
    facilities,
    activeFacilityId,
    activeFacility,
    setActiveFacilityId: setSelectedFacilityId,
    isLoading,
    error,
    isFacilityLocked: profile?.role === 'petugas_tps3r' || profile?.role === 'pengelola',
  };
}
