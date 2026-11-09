/**
 * Service integrasi WhatsApp Hybrid (Akasha Gateway + Fonnte Fallback).
 * 
 * ALUR KERJA:
 * 1. Prioritas Utama: Coba kirim via Akasha WhatsApp Gateway (self-hosted).
 * 2. Jika Akasha berhasil -> Selesai (Fonnte TIDAK dipanggil).
 * 3. Jika Akasha gagal / offline / timeout -> Otomatis fallback ke Fonnte.
 */

const DEFAULT_AKASHA_URL = 'https://akasha.tail5ad5ce.ts.net/api/send';
const FONNTE_URL = 'https://api.fonnte.com/send';

// Timeout fetch agar UI tidak macet jika server self-hosted sedang offline
function fetchWithTimeout(resource, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(resource, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(id));
}

export async function sendWhatsAppMessage({
  target,
  message,
  url,
  filename,
  type = 'text',
} = {}) {
  const akashaUrl = import.meta.env.VITE_WA_GATEWAY_URL || DEFAULT_AKASHA_URL;
  const akashaToken = import.meta.env.VITE_WA_GATEWAY_TOKEN;
  const fonnteToken = import.meta.env.VITE_FONNTE_TOKEN;
  const destination = target || import.meta.env.VITE_WA_GATEWAY_TARGET || import.meta.env.VITE_WA_HRD || import.meta.env.VITE_FONNTE_TARGET;

  if (!destination) {
    console.warn('[WhatsApp] Nomor tujuan WhatsApp belum ditentukan.');
    return { success: false, error: 'Nomor tujuan belum ditentukan' };
  }

  // 1. Coba kirim via Akasha Gateway (Self-hosted)
  if (akashaToken) {
    try {
      console.log('[WhatsApp] Mencoba kirim via Akasha Gateway...');
      const payloadAkasha = {
        target: destination,
        message,
        type: url ? (type === 'text' ? 'document' : type) : 'text',
      };
      if (url) {
        payloadAkasha.url = url;
        if (filename) payloadAkasha.filename = filename;
      }

      const res = await fetchWithTimeout(akashaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${akashaToken}`,
        },
        body: JSON.stringify(payloadAkasha),
      }, 8000);

      const data = await res.json().catch(() => null);

      if (res.ok && (data?.status === true || data?.success === true)) {
        console.log('[WhatsApp] Berhasil terkirim via Akasha Gateway.', data);
        return { success: true, provider: 'akasha', data };
      }

      console.warn('[WhatsApp] Akasha Gateway merespon gagal, bersiap fallback ke Fonnte...', data);
    } catch (err) {
      console.warn('[WhatsApp] Koneksi ke Akasha Gateway gagal/timeout:', err?.name === 'AbortError' ? 'Request Timeout (8s)' : err?.message);
    }
  } else {
    console.warn('[WhatsApp] Token Akasha Gateway tidak ditemukan, langsung ke Fonnte...');
  }

  // 2. Fallback: Kirim via Fonnte
  if (fonnteToken) {
    try {
      console.log('[WhatsApp] Menjalankan fallback pengiriman via Fonnte...');
      const payloadFonnte = {
        target: destination,
        message,
      };
      if (url) {
        payloadFonnte.url = url;
        if (filename) payloadFonnte.filename = filename;
      }

      const res = await fetchWithTimeout(FONNTE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: fonnteToken,
        },
        body: JSON.stringify(payloadFonnte),
      }, 10000);

      const data = await res.json().catch(() => null);

      if (res.ok && (data?.status === true || data?.status === 'true')) {
        console.log('[WhatsApp] Berhasil terkirim via Fonnte (Fallback).', data);
        return { success: true, provider: 'fonnte', data };
      }

      console.error('[WhatsApp] Fallback Fonnte juga gagal:', data);
      return { success: false, error: 'Semua gateway (Akasha & Fonnte) gagal mengirim pesan.', data };
    } catch (err) {
      console.error('[WhatsApp] Error pada fallback Fonnte:', err?.message);
      return { success: false, error: `Fonnte network error: ${err?.message}` };
    }
  }

  return {
    success: false,
    error: 'Tidak ada token gateway yang aktif (Akasha gagal dan token Fonnte tidak tersedia).',
  };
}
