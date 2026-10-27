-- ============================================================
-- Kuncian duplikat di level database (anti race condition)
-- Jalankan di Supabase SQL Editor.
-- Aturan: hanya blokir jika sudah ada data dengan status AKTIF
--         (PENDING / DISETUJUI / IZIN_DIBERIKAN).
--         Data DITOLAK / IZIN_TIDAK_DIBERIKAN boleh diajukan lagi.
-- ============================================================

-- ============================================================
-- 1) data_lembur : maksimal 1 baris aktif per karyawan per tanggal
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS data_lembur_aktif_unik
  ON public.data_lembur (id_karyawan, tanggal_lembur)
  WHERE status IN ('PENDING', 'DISETUJUI');

-- ============================================================
-- 2) data_izin : mencegah overlap rentang tanggal untuk data aktif
--    (pakai trigger karena bentuknya rentang, bukan satu tanggal)
-- ============================================================

CREATE OR REPLACE FUNCTION public.cek_overlap_izin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  aktif BOOLEAN;
  bentrok BOOLEAN;
BEGIN
  -- status aktif yang dianggap "memakai" tanggal
  aktif := NEW.status IN ('PENDING', 'DISETUJUI', 'IZIN_DIBERIKAN');

  IF NOT aktif THEN
    RETURN NEW; -- data ditolak/tidak diberikan, bebas dimasukkan
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.data_izin d
    WHERE d.id_karyawan = NEW.id_karyawan
      AND d.id <> COALESCE(NEW.id, -1)
      AND d.status IN ('PENDING', 'DISETUJUI', 'IZIN_DIBERIKAN')
      AND d.tanggal_izin_mulai <= NEW.tanggal_izin_akhir
      AND COALESCE(d.tanggal_izin_akhir, d.tanggal_izin_mulai) >= NEW.tanggal_izin_mulai
  )
  INTO bentrok;

  IF bentrok THEN
    RAISE EXCEPTION 'Karyawan sudah memiliki pengajuan izin aktif pada rentang tanggal tersebut'
      USING ERRCODE = '23505'; -- unique_violation
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cek_overlap_izin ON public.data_izin;
CREATE TRIGGER trg_cek_overlap_izin
  BEFORE INSERT OR UPDATE ON public.data_izin
  FOR EACH ROW
  EXECUTE FUNCTION public.cek_overlap_izin();
