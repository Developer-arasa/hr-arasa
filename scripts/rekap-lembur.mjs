// ============================================================
// Rekap lembur harian -> kirim WA ke HRD (Hybrid: Akasha Gateway -> Fonnte)
// Dapat dijalankan via GitHub Actions atau crontab server self-hosted.
// Tanpa dependensi pihak ketiga (menggunakan Node.js native fetch).
//
// Environment variables:
//   SUPABASE_URL       : URL project Supabase (wajib)
//   SUPABASE_KEY       : anon/public key Supabase (wajib)
//   WA_GATEWAY_URL     : URL Akasha Gateway (opsional, default: https://akasha.tail5ad5ce.ts.net/api/send)
//   WA_GATEWAY_TOKEN   : Token perangkat Akasha Gateway
//   FONNTE_TOKEN       : Token Fonnte (sebagai fallback jika Akasha tidak aktif)
//   WA_TARGET          : Nomor WA HRD (contoh: 628155138385)
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Auto-load .env atau .env.local jika dijalankan mandiri di server self-hosted
function tryLoadEnv() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(currentDir, '..');
  const envCandidates = [
    path.join(rootDir, '.env'),
    path.join(rootDir, '.env.local'),
  ];

  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      try {
        const raw = fs.readFileSync(envPath, 'utf8');
        for (const line of raw.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch (err) {
        // Abaikan jika gagal baca file
      }
    }
  }
}

tryLoadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;
const AKASHA_URL = process.env.WA_GATEWAY_URL || process.env.VITE_WA_GATEWAY_URL || 'https://akasha.tail5ad5ce.ts.net/api/send';
const AKASHA_TOKEN = process.env.WA_GATEWAY_TOKEN || process.env.VITE_WA_GATEWAY_TOKEN;
const FONNTE_TOKEN = process.env.FONNTE_TOKEN || process.env.VITE_FONNTE_TOKEN;
const WA_TARGET = process.env.WA_TARGET || process.env.WA_GATEWAY_TARGET || process.env.FONNTE_TARGET || process.env.VITE_WA_HRD;

function log(msg) {
  console.log(`[rekap-lembur] ${msg}`);
}

function formatTanggal(dateStr) {
  // dateStr = 'YYYY-MM-DD'
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d}/${m}/${y}`;
}

function formatDurasi(durasi) {
  // durasi dalam jam (decimal), contoh 2.5 -> '2 Jam 30 Menit'
  const totalMenit = Math.round(parseFloat(durasi) * 60);
  if (!totalMenit || isNaN(totalMenit)) return '0 Menit';
  const j = Math.floor(totalMenit / 60);
  const m = totalMenit % 60;
  if (j > 0 && m > 0) return `${j} Jam ${m} Menit`;
  if (j > 0) return `${j} Jam`;
  return `${m} Menit`;
}

async function dispatchWhatsAppHybrid(target, message) {
  let akashaSuccess = false;

  // 1. Coba Akasha Gateway
  if (AKASHA_TOKEN) {
    log(`Mencoba kirim ke ${target} via Akasha Gateway (${AKASHA_URL})...`);
    try {
      const res = await fetch(AKASHA_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AKASHA_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target, message }),
        signal: AbortSignal.timeout(10000), // Timeout 10 detik
      });

      const data = await res.json().catch(() => null);
      if (res.ok && (data?.status === true || data?.success === true)) {
        log(`SUKSES: Pesan terkirim via Akasha Gateway. Job ID: ${data.jobId || data.data?.jobId || '-'}`);
        akashaSuccess = true;
        return;
      }
      log(`Akasha Gateway mengembalikan respon tidak sukses: ${JSON.stringify(data)}`);
    } catch (err) {
      log(`Gagal menghubungi Akasha Gateway: ${err.message}`);
    }
  } else {
    log('Token Akasha Gateway (WA_GATEWAY_TOKEN) tidak disetel. Lewati ke Fonnte...');
  }

  // 2. Fallback Fonnte jika Akasha gagal
  if (!akashaSuccess) {
    if (!FONNTE_TOKEN) {
      throw new Error('Akasha Gateway gagal dan FONNTE_TOKEN tidak tersedia sebagai cadangan.');
    }

    log(`Menjalankan fallback: Mengirim rekap ke ${target} via Fonnte...`);
    const fonnteRes = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: FONNTE_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target, message }),
      signal: AbortSignal.timeout(15000),
    });

    if (!fonnteRes.ok) {
      const body = await fonnteRes.text();
      throw new Error(`Fallback Fonnte juga gagal: ${fonnteRes.status} ${body}`);
    }

    const fonnteData = await fonnteRes.json().catch(() => null);
    log('SUKSES: Rekap lembur berhasil dikirim via Fonnte (Fallback).');
    console.log(JSON.stringify(fonnteData, null, 2));
  }
}

async function main() {
  // Validasi env minimal
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('SUPABASE_URL atau SUPABASE_KEY belum diisi.');
  }

  if (!AKASHA_TOKEN && !FONNTE_TOKEN) {
    throw new Error('Minimal salah satu token (WA_GATEWAY_TOKEN atau FONNTE_TOKEN) harus diisi.');
  }

  if (!WA_TARGET) {
    throw new Error('Nomor WA target HRD belum diisi.');
  }

  // Tanggal hari ini dalam zona WIB (UTC+7)
  const now = new Date();
  const wib = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60000);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const d = String(wib.getUTCDate()).padStart(2, '0');
  const today = `${y}-${m}-${d}`;

  log(`Mengambil data lembur untuk tanggal ${today} (WIB) ...`);

  // Ambil data lembur hari ini dari Supabase REST.
  const url = `${SUPABASE_URL}/rest/v1/data_lembur?tanggal_lembur=eq.${today}&select=id_karyawan,nama,jam_awal,jam_selesai,durasi,alasan,status`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Gagal ambil data dari Supabase: ${res.status} ${res.statusText}`);
  }

  const rows = await res.json();
  const dataAktif = (rows || []).filter((r) =>
    ['PENDING', 'DISETUJUI', 'IZIN_DIBERIKAN'].includes((r.status || '').toUpperCase()),
  );

  if (dataAktif.length === 0) {
    log('Tidak ada pengajuan lembur hari ini. Tidak mengirim WA.');
    return;
  }

  // Rangkai pesan rekap
  const lines = [
    `*REKAP LEMBUR ${formatTanggal(today)}*`,
    `Total pengajuan: ${dataAktif.length} orang`,
    '',
  ];

  dataAktif.forEach((r, i) => {
    const jam = `${(r.jam_awal || '').slice(0, 5)} - ${(r.jam_selesai || '').slice(0, 5)}`;
    const durasi = formatDurasi(r.durasi);
    lines.push(`${i + 1}. ${r.nama || '-'} (${jam}) - ${durasi}`);
    if (r.alasan) lines.push(`   Alasan: ${r.alasan}`);
  });

  lines.push('');
  lines.push('Mohon segera ditindaklanjuti.');

  const message = lines.join('\n');
  await dispatchWhatsAppHybrid(WA_TARGET, message);
}

main().catch((err) => {
  console.error(`[rekap-lembur] ERROR: ${err.message}`);
  process.exit(1);
});
