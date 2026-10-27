# Rekap Lembur Otomatis (Jam 10:00 WIB)

Fitur ini mengirim **rekap pengajuan lembur harian** ke WhatsApp HRD secara otomatis
setiap hari pukul 10:00 pagi, berisi total pengajuan + daftar siapa saja.

## Cara kerja

1. GitHub Actions menjalankan cron setiap hari jam 10:00 WIB (03:00 UTC).
2. Workflow menjalankan `scripts/rekap-lembur.mjs`.
3. Skrip membaca data lembur hari ini dari Supabase (status PENDING/DISETUJUI),
   lalu mengirim ringkasan ke WhatsApp HRD via Fonnte.

## Langkah setup (sekali saja)

### 1. Tambahkan GitHub Secrets

Buka repo di GitHub → **Settings → Secrets and variables → Actions → New repository secret**.
Tambahkan 4 secret berikut:

| Nama secret | Isi |
|---|---|
| `SUPABASE_URL` | URL project Supabase (sama seperti `VITE_SUPABASE_URL`) |
| `SUPABASE_KEY` | anon/public key Supabase (sama seperti `VITE_SUPABASE_KEY`) |
| `FONNTE_TOKEN` | token Fonnte Anda |
| `FONNTE_TARGET` | nomor WA HRD, contoh `628155138385` |

### 2. Aktifkan workflow

Setelah file `.github/workflows/rekap-lembur.yml` ter-push ke repo, workflow
otomatis terdaftar. Untuk tes cepat, buka tab **Actions → Rekap Lembur Harian →
Run workflow** (manual trigger).

## Catatan penting

- **Repo harus publik** agar cron GitHub Actions berjalan tepat waktu.
  Untuk repo privat, jadwal cron bisa tertunda/tidak terjamin — sebaiknya
  pertimbangkan cron-job.org atau upgrade.
- Token Fonnte tersimpan aman di GitHub Secrets, TIDAK masuk ke browser/app.
- Zona waktu rekap memakai WIB (UTC+7).
