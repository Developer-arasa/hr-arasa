# Rekap Lembur Otomatis (Jam 11:00 WIB di Server Self-Hosted)

Fitur ini mengirim **rekap pengajuan lembur harian** ke WhatsApp HRD secara otomatis setiap hari pukul **11:00 WIB**, berisi total pengajuan + daftar karyawan yang mengajukan lembur.

Sistem menggunakan arsitektur **Hybrid WhatsApp**:
1. Mengirim pesan via **Akasha WhatsApp Gateway** (*self-hosted*).
2. Jika server Akasha offline / gagal, otomatis *fallback* mengirim via **Fonnte**.

---

## 🖥️ Setup Cron di Server Self-Hosted

Cron dijalankan langsung di server *self-hosted* kamu (tempat Akasha Gateway berjalan) sehingga tepat waktu dan tidak bergantung pada cloud scheduler luar.

### 1. Pastikan Node.js (v18+) terinstall di server:
```bash
node -v
```

### 2. Buat file `.env` di folder proyek di server:
```env
SUPABASE_URL=https://dhlmzugrqvrmoicbnmpn.supabase.co
SUPABASE_KEY=sb_publishable_4e2ckBZ-OzOaF4LBIS1ZTQ_y6Ve1AOh
WA_TARGET=628155138385

# Primary Gateway (Akasha)
WA_GATEWAY_URL=https://akasha.tail5ad5ce.ts.net/api/send
WA_GATEWAY_TOKEN=device_Web_HR_8ce34e0af211f81a

# Fallback Gateway (Fonnte jika Akasha offline)
FONNTE_TOKEN=q5cvmm35yg8F3SKGYZMS
```
*(Skrip `rekap-lembur.mjs` sudah otomatis membaca file `.env` atau `.env.local` saat dijalankan).*

### 3. Uji Coba Manual:
```bash
node scripts/rekap-lembur.mjs
```

### 4. Daftarkan di Crontab Linux (Jam 11:00 Siang WIB):
Buka crontab di terminal server:
```bash
crontab -e
```

Tambahkan baris berikut di paling bawah:
```cron
# Jika timezone server Anda sudah WIB (Asia/Jakarta):
0 11 * * * cd /path/ke/arasahr && /usr/bin/node scripts/rekap-lembur.mjs >> /path/ke/arasahr/rekap-lembur.log 2>&1

# Atau jika timezone server menggunakan UTC (04:00 UTC = 11:00 WIB):
# 0 4 * * * cd /path/ke/arasahr && /usr/bin/node scripts/rekap-lembur.mjs >> /path/ke/arasahr/rekap-lembur.log 2>&1
```

*(Opsi lain jika server menggunakan **PM2**)*:
```bash
pm2 start scripts/rekap-lembur.mjs --name "rekap-lembur" --cron "0 11 * * *" --no-autorestart
```

---

## 🔍 Log & Troubleshooting
- Jika Akasha Gateway aktif, log akan menampilkan:
  `[rekap-lembur] SUKSES: Pesan terkirim via Akasha Gateway. Job ID: ...`
- Jika Akasha Gateway offline atau token bermasalah:
  `[rekap-lembur] Menjalankan fallback: Mengirim rekap ke ... via Fonnte...`
  `[rekap-lembur] SUKSES: Rekap lembur berhasil dikirim via Fonnte (Fallback).`
