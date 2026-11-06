import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { MaterialCategory } from '../../types';

export const DEFAULT_FALLBACK_CATEGORIES: MaterialCategory[] = [
  { id: '00000000-0000-0000-0000-000000000101', code: 'organik', name: 'Organik (Sisa Makanan & Daun)', default_tolerance_pct: 5.0, sort_order: 1, is_active: true },
  { id: '00000000-0000-0000-0000-000000000102', code: 'plastik', name: 'Plastik (PET, HDPE, Film)', default_tolerance_pct: 3.0, sort_order: 2, is_active: true },
  { id: '00000000-0000-0000-0000-000000000103', code: 'kertas', name: 'Kertas & Karton / Kardus', default_tolerance_pct: 4.0, sort_order: 3, is_active: true },
  { id: '00000000-0000-0000-0000-000000000104', code: 'logam', name: 'Logam (Aluminium, Besi, Seng)', default_tolerance_pct: 2.0, sort_order: 4, is_active: true },
  { id: '00000000-0000-0000-0000-000000000105', code: 'kaca', name: 'Kaca / Botol', default_tolerance_pct: 3.0, sort_order: 5, is_active: true },
  { id: '00000000-0000-0000-0000-000000000106', code: 'residu', name: 'Residu (Tidak Dapat Didaur Ulang)', default_tolerance_pct: 5.0, sort_order: 6, is_active: true },
];

export function useCategories() {
  const { data: categories = DEFAULT_FALLBACK_CATEGORIES, isLoading, error } = useQuery<MaterialCategory[]>({
    queryKey: ['material_categories'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return DEFAULT_FALLBACK_CATEGORIES;

      const { data, error } = await supabase
        .from('material_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error || !data || data.length === 0) {
        return DEFAULT_FALLBACK_CATEGORIES;
      }
      return data as MaterialCategory[];
    },
    staleTime: 60 * 60 * 1000,
  });

  return { categories, isLoading, error };
}
