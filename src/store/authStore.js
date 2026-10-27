import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

/**
 * Menentukan apakah akun karyawan masih "terkunci" dan wajib
 * melengkapi biodata + mengganti PIN sebelum akses fitur lain.
 * Terkunci jika: PIN masih default '123456' ATAU ada field
 * biodata editable yang kosong/null.
 */
export function isIncomplete(user) {
  if (!user) return false;
  if (user.pin === '123456') return true;
  const required = [
    'tempat_lahir',
    'tgl_lahir',
    'no_hp',
    'alamat_domisili',
    'status_nikah',
    'kontak_darurat',
  ];
  return required.some((k) => !user[k] || String(user[k]).trim() === '');
}

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

      /**
       * Selesaikan pendaftaran wajib: update biodata + PIN baru
       * dalam satu transaksi untuk karyawan yang terkunci.
       */
      completeSetup: async (payload) => {
        const current = get().user;
        if (!current) return { ok: false, message: 'Sesi berakhir. Silakan login ulang.' };
        const { error } = await supabase
          .from('master_data')
          .update(payload)
          .eq('id_karyawan', current.id_karyawan);
        if (error) {
          return { ok: false, message: 'Gagal terhubung ke server. Coba lagi nanti.' };
        }
        await get().refreshUser();
        return { ok: true };
      },

      logout: () => set({ user: null }),
    }),
    {
      name: 'arasa-session',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
