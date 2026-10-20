import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      loading: false,

      /**
       * Login dengan id_karyawan + pin.
       * Mencari kecocokan di tabel master_data.
       */
      login: async (id_karyawan, pin) => {
        set({ loading: true });
        try {
          const { data, error } = await supabase
            .from('master_data')
            .select('*')
            .eq('id_karyawan', id_karyawan)
            .eq('pin', pin)
            .maybeSingle();

          if (error) {
            set({ loading: false });
            return { ok: false, message: 'Gagal terhubung ke server. Coba lagi nanti.' };
          }

          if (!data) {
            set({ loading: false });
            return { ok: false, message: 'ID Karyawan atau PIN salah.' };
          }

          set({ user: data, loading: false });
          return { ok: true, user: data };
        } catch {
          set({ loading: false });
          return { ok: false, message: 'Terjadi kesalahan. Coba lagi nanti.' };
        }
      },

      /** Refresh data user dari server (untuk update profil/PIN). */
      refreshUser: async () => {
        const current = get().user;
        if (!current) return;
        const { data } = await supabase
          .from('master_data')
          .select('*')
          .eq('id_karyawan', current.id_karyawan)
          .maybeSingle();
        if (data) set({ user: data });
      },

      logout: () => set({ user: null }),
    }),
    {
      name: 'arasa-session',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
