-- Hapus kolom NIK dari tabel master_data.
-- Jalankan sekali di SQL Editor Supabase (database.md bersifat konteks saja).
ALTER TABLE public.master_data
  DROP COLUMN IF EXISTS nik_ktp;
