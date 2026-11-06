import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { UserProfile } from '../../types';

interface AuthState {
  sessionUser: any | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  mustChangePassword: boolean;
  initAuth: () => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
}

export const useAuth = create<AuthState>((set, get) => ({
  sessionUser: null,
  profile: null,
  isLoading: true,
  error: null,
  mustChangePassword: false,

  initAuth: async () => {
    try {
      if (!isSupabaseConfigured) {
        set({ profile: null, sessionUser: null, isLoading: false });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileData) {
          set({
            sessionUser: session.user,
            profile: profileData as UserProfile,
            mustChangePassword: Boolean(profileData.must_change_password),
            isLoading: false,
          });
          return;
        }
      }

      set({ sessionUser: null, profile: null, isLoading: false });
    } catch (e: any) {
      console.warn('Auth initialization warning:', e.message);
      set({ sessionUser: null, profile: null, isLoading: false });
    }
  },

  signIn: async (identifier, password) => {
    set({ isLoading: true, error: null });

    if (!isSupabaseConfigured) {
      const errMsg = 'Layanan belum dikonfigurasi. Hubungi administrator sistem.';
      set({ isLoading: false, error: errMsg });
      return { ok: false, error: errMsg };
    }

    // Format username to email if needed
    const email = identifier.includes('@') ? identifier : `${identifier.trim().toLowerCase()}@sirkula.app`;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        set({ isLoading: false, error: error.message });
        return { ok: false, error: error.message };
      }

      if (data.user) {
        const { data: profileData, error: profError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profError || !profileData) {
          set({ isLoading: false, error: 'Profil pengguna tidak ditemukan.' });
          return { ok: false, error: 'Profil pengguna tidak ditemukan.' };
        }

        const prof = profileData as UserProfile;
        if (!prof.is_active) {
          await supabase.auth.signOut();
          set({ isLoading: false, error: 'Akun Anda dinonaktifkan oleh administrator.' });
          return { ok: false, error: 'Akun dinonaktifkan.' };
        }

        set({
          sessionUser: data.user,
          profile: prof,
          mustChangePassword: Boolean(prof.must_change_password),
          isLoading: false,
        });
        return { ok: true };
      }

      set({ isLoading: false, error: 'Login gagal.' });
      return { ok: false, error: 'Login gagal.' };
    } catch (e: any) {
      set({ isLoading: false, error: e.message });
      return { ok: false, error: e.message };
    }
  },

  signOut: async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    set({ sessionUser: null, profile: null, mustChangePassword: false });
  },

  updatePassword: async (newPassword) => {
    if (newPassword.length < 10) {
      return { ok: false, error: 'Kata sandi minimal 10 karakter.' };
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { ok: false, error: error.message };

      const user = get().sessionUser;
      if (user) {
        await supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', user.id);
      }
    }

    set({ mustChangePassword: false });
    return { ok: true };
  },
}));
