-- ============================================================
-- Arasa HR - Migration: Upgrade Database (Legacy -> Blueprint)
-- JALANKAN DI SUPABASE SQL EDITOR (sekali saja)
-- ============================================================

-- 1. Tambah kolom baru ke master_data (auth + buku induk)
ALTER TABLE public.master_data
  ADD COLUMN IF NOT EXISTS pin              character varying DEFAULT '123456',
  ADD COLUMN IF NOT EXISTS role             character varying DEFAULT 'karyawan',
  ADD COLUMN IF NOT EXISTS nik_ktp          character varying,
  ADD COLUMN IF NOT EXISTS jabatan          character varying,
  ADD COLUMN IF NOT EXISTS departemen       character varying,
  ADD COLUMN IF NOT EXISTS tgl_gabung       date,
  ADD COLUMN IF NOT EXISTS tempat_lahir     character varying,
  ADD COLUMN IF NOT EXISTS tgl_lahir        date,
  ADD COLUMN IF NOT EXISTS no_hp            character varying,
  ADD COLUMN IF NOT EXISTS alamat_domisili  text,
  ADD COLUMN IF NOT EXISTS status_nikah     character varying,
  ADD COLUMN IF NOT EXISTS kontak_darurat   character varying;

-- 2. Pastikan semua karyawan yang sudah ada punya PIN default
UPDATE public.master_data
SET pin = '123456'
WHERE pin IS NULL OR pin = '';

-- 3. Buat tabel pengumuman (notice board)
CREATE TABLE IF NOT EXISTS public.data_pengumuman (
  id             serial PRIMARY KEY,
  judul          character varying NOT NULL,
  isi_pesan      text,
  tanggal        date DEFAULT CURRENT_DATE,
  label_kategori character varying DEFAULT 'Info',
  created_at     timestamp without time zone DEFAULT now()
);

-- 4. Foreign Key (opsional, blueprint menyebut ini)
--    Hanya jalankan jika data id_karyawan di data_izin / data_lembur
--    sudah konsisten dengan master_data.
-- ALTER TABLE public.data_izin
--   ADD CONSTRAINT data_izin_id_karyawan_fkey
--   FOREIGN KEY (id_karyawan) REFERENCES public.master_data (id_karyawan)
--   ON DELETE SET NULL;

-- ALTER TABLE public.data_lembur
--   ADD CONSTRAINT data_lembur_id_karyawan_fkey
--   FOREIGN KEY (id_karyawan) REFERENCES public.master_data (id_karyawan)
--   ON DELETE SET NULL;

-- 5. Index untuk pencarian autocomplete
CREATE INDEX IF NOT EXISTS idx_master_nama ON public.master_data (nama_karyawan);
CREATE INDEX IF NOT EXISTS idx_izin_id_karyawan ON public.data_izin (id_karyawan);
CREATE INDEX IF NOT EXISTS idx_lembur_id_karyawan ON public.data_lembur (id_karyawan);
