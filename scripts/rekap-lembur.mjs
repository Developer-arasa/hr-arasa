// ============================================================
// Rekap lembur harian -> kirim WA ke HRD via Fonnte
// Dijalankan oleh GitHub Actions setiap hari jam 10:00 (WIB).
// Tidak butuh dependency (pakai fetch bawaan Node 18+).
//
// Environment variables yang wajib (diisi lewat GitHub Secrets):
//   SUPABASE_URL      : URL project Supabase
//   SUPABASE_KEY      : anon/public key Supabase
//   FONNTE_TOKEN      : token Fonnte (Authorization)
//   FONNTE_TARGET     : nomor WA HRD (contoh: 628155138385)
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const FONNTE_TOKEN = process.env.FONNTE_TOKEN;
const FONNTE_TARGET = process.env.FONNTE_TARGET;

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

async function main() {
  // Validasi env
  const missing = [
    ['SUPABASE_URL', SUPABASE_URL],
    ['SUPABASE_KEY', SUPABASE_KEY],
    ['FONNTE_TOKEN', FONNTE_TOKEN],
    ['FONNTE_TARGET', FONNTE_TARGET],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(`Environment variables belum diisi: ${missing.join(', ')}`);
  }

  // Tanggal hari ini dalam zona WIB (UTC+7)
  const now = new Date();
  const wib = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60000);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const d = String(wib.getUTCDate()).padStart(2, '0');
  const today = `${y}-${m}-${d}`;

  log(`Mengambil data lembur untuk tanggal ${today} ...`);

  // Ambil data lembur hari ini dari Supabase REST.
  // Filter status: PENDING + DISETUJUI (yang DITOLAK tidak diikutsertakan).
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

  log(`Mengirim rekap ke ${FONNTE_TARGET} ...`);

  const sendRes = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: {
      Authorization: FONNTE_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ target: FONNTE_TARGET, message }),
  });

  if (!sendRes.ok) {
    const body = await sendRes.text();
    throw new Error(`Gagal kirim WA via Fonnte: ${sendRes.status} ${body}`);
  }

  const sendBody = await sendRes.json();
  log('Rekap lembur berhasil dikirim.');
  console.log(JSON.stringify(sendBody, null, 2));
}

main().catch((err) => {
  console.error(`[rekap-lembur] ERROR: ${err.message}`);
  process.exit(1);
});
