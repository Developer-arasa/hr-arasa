import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import {
  IconClock, IconChart, IconList, IconCal, IconInbox, IconPen,
  IconChevronRight, IconChevronLeft, IconCheck, IconPlus,
  IconSort, IconLayers
} from '../components/Icons';
import { z } from 'zod';

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatJam(durasi) {
  const totalMenit = Math.round(parseFloat(durasi) * 60);
  if (!totalMenit || isNaN(totalMenit)) return '0 Menit';
  const j = Math.floor(totalMenit / 60);
  const m = totalMenit % 60;
  if (j > 0 && m > 0) return `${j} Jam ${m} Menit`;
  if (j > 0) return `${j} Jam`;
  return `${m} Menit`;
}

const lemburSchema = z.object({
  tgl: z.string().min(1, 'Tanggal wajib diisi'),
  jam_awal: z.string().min(1, 'Jam mulai wajib diisi'),
  jam_selesai: z.string().min(1, 'Jam selesai wajib diisi'),
  alasan: z.string().min(1, 'Uraian tugas wajib diisi'),
});

export default function Lembur() {
  const user = useAuthStore((s) => s.user);

  const [tgl, setTgl] = useState('');
  const [jamAwal, setJamAwal] = useState('');
  const [jamSelesai, setJamSelesai] = useState('');
  const [alasan, setAlasan] = useState('');

  const [historyLembur, setHistoryLembur] = useState([]);
  const bulanOptions = [...new Set((historyLembur || []).map((r) => r.bulan_lembur).filter(Boolean))].sort();
  const [tab, setTab] = useState('pengajuan'); // 'pengajuan' | 'riwayat'
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [bulanFilter, setBulanFilter] = useState('semua');
  const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc' | 'date-asc' | 'durasi-desc' | 'durasi-asc'
  const [groupBy, setGroupBy] = useState('bulan'); // 'bulan' | 'status' | 'none'
  const [calDate, setCalDate] = useState(new Date()); // State navigasi bulan kalender

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState(null);
  const [modalLembur, setModalLembur] = useState(null);
  const [editId, setEditId] = useState(null);

  const todayMax = (() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('data_lembur')
      .select('*')
      .eq('id_karyawan', user?.id_karyawan)
      .order('tanggal_lembur', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setHistoryLembur(data || []);
      });
    return () => { cancelled = true; };
  }, [user?.id_karyawan]);

  function showAlert(msg, icon = 'bell') {
    setModal({ type: 'alert', msg, icon });
  }
  function closeModal() {
    setModal(null);
  }

  // Perhitungan Jam Lembur Bulan Ini
  const now = new Date();
  const currentMonthStr = `${NAMA_BULAN[now.getMonth()]} ${now.getFullYear()}`;
  const isApproved = (s) => ['DISETUJUI', 'IZIN_DIBERIKAN', 'IZIN DIBERIKAN'].includes((s || '').trim().toUpperCase());
  const thisMonthData = historyLembur.filter((r) => r.bulan_lembur === currentMonthStr);
  const thisMonthApproved = thisMonthData.filter((r) => isApproved(r.status));
  const totalJamBulanIni = parseFloat(thisMonthApproved.reduce((acc, r) => acc + (parseFloat(r.durasi) || 0), 0).toFixed(1));
  const approvedCount = historyLembur.filter((r) => isApproved(r.status)).length;
  const pendingCount = historyLembur.filter((r) => (r.status || 'PENDING').toUpperCase() === 'PENDING').length;

  // Ring calculations (Visual progress fill berdasarkan jam lembur aktual)
  const ringPct = totalJamBulanIni > 0 ? Math.min(100, Math.max(15, Math.round(totalJamBulanIni * 10))) : 0;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * ringPct) / 100;

  // Live Durasi Calculation
  const liveDurasi = (() => {
    if (!jamAwal || !jamSelesai) return null;
    const [h1, m1] = jamAwal.split(':').map(Number);
    const [h2, m2] = jamSelesai.split(':').map(Number);
    let totalMins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (totalMins < 0) totalMins += 24 * 60;
    const j = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${j > 0 ? `${j} Jam ` : ''}${m > 0 ? `${m} Menit` : j === 0 ? '0 Menit' : ''}`;
  })();

  function handleSubmit(e) {
    e.preventDefault();

    const parsed = lemburSchema.safeParse({ tgl, jam_awal: jamAwal, jam_selesai: jamSelesai, alasan });
    if (!parsed.success) {
      const fieldErrors = {};
      parsed.error.issues.forEach((i) => { fieldErrors[i.path[0]] = i.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    const inputDate = new Date(tgl);
    const today = new Date();
    inputDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    if (inputDate > today) {
      showAlert('Tidak bisa mengajukan lembur untuk hari esok atau masa depan!', 'error');
      return;
    }

    const riwayatTanggal = historyLembur.filter(
      (h) => h.id_karyawan == user.id_karyawan && h.tanggal_lembur == tgl,
    );

    const sudahAcc = riwayatTanggal.find(
      (h) => ['DISETUJUI', 'IZIN_DIBERIKAN'].includes((h.status || '').toUpperCase()),
    );
    if (sudahAcc) {
      showAlert('Lembur pada tanggal tersebut sudah disetujui HRD.', 'error');
      return;
    }

    const pending = riwayatTanggal.find(
      (h) => (h.status || 'PENDING').toUpperCase() === 'PENDING',
    );

    if (pending) {
      setEditId(pending.id);
      setModal({
        type: 'confirm',
        icon: 'question',
        title: 'Edit Jam Lembur',
        msg: 'Sudah ada pengajuan di tanggal ini (menunggu ACC). Lanjutkan perbarui data?',
      });
      return;
    }

    setEditId(null);
    setModal({
      type: 'confirm',
      icon: 'question',
      title: 'Konfirmasi',
      msg: 'Pastikan jam kerja lembur sudah benar. Lanjutkan kirim data?',
    });
  }

  async function doSubmit() {
    closeModal();
    setSubmitting(true);

    const [h1, m1] = jamAwal.split(':').map(Number);
    const [h2, m2] = jamSelesai.split(':').map(Number);
    let totalMins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (totalMins < 0) totalMins += 24 * 60;
    const durasiDec = parseFloat((totalMins / 60).toFixed(2));

    const dObj = new Date(tgl);
    const bulanStr = `${NAMA_BULAN[dObj.getMonth()]} ${dObj.getFullYear()}`;

    const payload = {
      jam_awal: jamAwal,
      jam_selesai: jamSelesai,
      durasi: durasiDec,
      alasan,
      bulan_lembur: bulanStr,
      status: 'PENDING',
    };

    try {
      if (editId) {
        const { error } = await supabase
          .from('data_lembur')
          .update(payload)
          .eq('id', editId)
          .eq('id_karyawan', user.id_karyawan);
        if (error) throw error;
        setModal({ type: 'alert', icon: 'success', msg: 'Data lembur berhasil diperbarui dan menunggu persetujuan HRD.' });
      } else {
        const { data: existing } = await supabase
          .from('data_lembur')
          .select('id, status')
          .eq('id_karyawan', user.id_karyawan)
          .eq('tanggal_lembur', tgl);

        const sudahAda = (existing || []).find(
          (h) => (h.status || 'PENDING').toUpperCase() !== 'DITOLAK',
        );
        if (sudahAda) {
          setModal({ type: 'alert', icon: 'error', msg: 'Data lembur pada tanggal tersebut sudah ada.' });
          return;
        }

        const { error } = await supabase.from('data_lembur').insert([
          { ...payload, id_karyawan: user.id_karyawan, nama: user.nama_karyawan, tanggal_lembur: tgl },
        ]);
        if (error) throw error;
        setModal({ type: 'alert', icon: 'success', msg: 'Berhasil! Data lembur terkirim dan menunggu persetujuan HRD.' });
      }

      setTgl('');
      setJamAwal('');
      setJamSelesai('');
      setAlasan('');

      const { data: updated } = await supabase
        .from('data_lembur')
        .select('*')
        .eq('id_karyawan', user?.id_karyawan)
        .order('tanggal_lembur', { ascending: false });
      if (updated) setHistoryLembur(updated);
    } catch {
      setModal({ type: 'alert', icon: 'error', msg: 'Gagal terhubung ke server. Silakan coba lagi.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Kalender Navigation Handlers
  function prevMonth() {
    setCalDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCalDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }
  function resetToCurrentMonth() {
    setCalDate(new Date());
  }

  return (
    <div className="page-enter" style={{ paddingBottom: 50 }}>
      {/* ===== HERO COMPACT FOCAL TRACKER ===== */}
      <div className="focal-hero-header">
        <div className="focal-top-bar">
          <Link to="/" className="focal-back-btn" title="Dashboard">
            <IconChevronLeft style={{ width: 16, height: 16 }} />
          </Link>
          <div className="focal-center-pill">
            <span>{currentMonthStr}</span>
          </div>
          <div className="focal-right-badge">
            LEMBUR
          </div>
        </div>

        {/* Compact Ring */}
        <div className="focal-donut-section">
          <div className="focal-ring-container">
            <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform: 'rotate(-90deg)' }}>
              <defs>
                <linearGradient id="lemburRingGradCompact" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a3e635" />
                  <stop offset="50%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>
              <circle
                cx="64"
                cy="64"
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth="9"
              />
              <circle
                cx="64"
                cy="64"
                r={radius}
                fill="none"
                stroke="url(#lemburRingGradCompact)"
                strokeWidth="9"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
            </svg>

            <div className="focal-ring-content">
              <div className="focal-ring-value">
                {totalJamBulanIni} <span style={{ fontSize: 13, fontWeight: 700 }}>Jam</span>
              </div>
              <div className="focal-ring-sub">
                Total Lembur
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row on hero */}
        <div className="focal-bottom-row">
          <div>
            <div className="focal-active-text">Akumulasi Bulan Ini</div>
            <div className="focal-active-val">{totalJamBulanIni} Jam Disetujui</div>
          </div>
          <button
            type="button"
            className="focal-topup-btn"
            onClick={() => setTab('pengajuan')}
          >
            <IconPlus style={{ width: 13, height: 13 }} />
            <span>Catat Lembur</span>
          </button>
        </div>
      </div>

      {/* ===== TWO COMPACT SUB-CARDS ("NUMPUK") ===== */}
      <div className="focal-overlap-grid">
        {/* Card 1: Disetujui */}
        <div className="focal-sub-card">
          <div className="focal-card-head">
            <div className="focal-card-title-group">
              <div className="squircle-badge-green" style={{ width: 30, height: 30, borderRadius: 10, background: '#dcfce7', color: '#15803d' }}>
                <IconClock style={{ width: 16, height: 16 }} />
              </div>
              <div>
                <div className="focal-card-name" style={{ fontSize: 12 }}>Lembur ACC</div>
                <div className="focal-card-type">{thisMonthApproved.length} Sesi</div>
              </div>
            </div>
            <span style={{ color: '#94a3b8', fontSize: 14 }}>···</span>
          </div>

          <div style={{ marginTop: 2 }}>
            <div className="focal-card-metric" style={{ fontSize: 16 }}>{totalJamBulanIni} Jam</div>
            <div className="focal-progress-bar-wrap" style={{ height: 5, marginTop: 4 }}>
              <div
                className="focal-progress-bar-fill"
                style={{
                  width: `${ringPct}%`,
                  background: 'linear-gradient(90deg, #10b981, #06b6d4)'
                }}
              />
            </div>
            <div className="focal-progress-footer" style={{ marginTop: 4 }}>
              <span>{totalJamBulanIni} Jam Disetujui</span>
              <span>{thisMonthApproved.length} Sesi</span>
            </div>
          </div>
        </div>

        {/* Card 2: Menunggu */}
        <div className="focal-sub-card">
          <div className="focal-card-head">
            <div className="focal-card-title-group">
              <div className="squircle-badge-green" style={{ width: 30, height: 30, borderRadius: 10, background: '#eff6ff', color: '#2563eb' }}>
                <IconInbox style={{ width: 16, height: 16 }} />
              </div>
              <div>
                <div className="focal-card-name" style={{ fontSize: 12 }}>Menunggu ACC</div>
                <div className="focal-card-type">{pendingCount} Antrean</div>
              </div>
            </div>
            <span style={{ color: '#94a3b8', fontSize: 14 }}>···</span>
          </div>

          <div style={{ marginTop: 2 }}>
            <div className="focal-card-metric" style={{ fontSize: 16 }}>{pendingCount} Sesi</div>
            <div className="focal-progress-bar-wrap" style={{ height: 5, marginTop: 4 }}>
              <div
                className="focal-progress-bar-fill"
                style={{
                  width: `${pendingCount > 0 ? Math.min(100, pendingCount * 40) : 100}%`,
                  background: pendingCount > 0
                    ? 'linear-gradient(90deg, #f59e0b, #3b82f6)'
                    : 'linear-gradient(90deg, #10b981, #06b6d4)'
                }}
              />
            </div>
            <div className="focal-progress-footer" style={{ marginTop: 4 }}>
              <span>{approvedCount} Disetujui</span>
              <span>{pendingCount > 0 ? 'Review' : 'Beres'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== SEGMENTED CONTROLLER (MAKES PAGE SHORT & CLEAN) ===== */}
      <div style={{
        display: 'flex',
        background: '#e2e8f0',
        padding: 3,
        borderRadius: 14,
        marginBottom: 14
      }}>
        <button
          type="button"
          onClick={() => setTab('pengajuan')}
          className={`segmented-tab-btn ${tab === 'pengajuan' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '8px 14px',
            borderRadius: 11,
            fontSize: 12,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            background: tab === 'pengajuan' ? '#ffffff' : 'transparent',
            color: tab === 'pengajuan' ? 'var(--text-heading)' : 'var(--text-muted)',
            boxShadow: tab === 'pengajuan' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}
        >
          <IconPen style={{ width: 14, height: 14 }} />
          <span>Catat Lembur</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('riwayat')}
          className={`segmented-tab-btn ${tab === 'riwayat' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '8px 14px',
            borderRadius: 11,
            fontSize: 12,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            background: tab === 'riwayat' ? '#ffffff' : 'transparent',
            color: tab === 'riwayat' ? 'var(--text-heading)' : 'var(--text-muted)',
            boxShadow: tab === 'riwayat' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}
        >
          <IconList style={{ width: 14, height: 14 }} />
          <span>Riwayat ({historyLembur.length})</span>
        </button>
      </div>

      {/* ===== TAB 1: FORM CATAT LEMBUR (COMPACT & RINGKAS) ===== */}
      {tab === 'pengajuan' && (
        <div
          key="pengajuan"
          className="subtab-spring-enter"
          style={{
            background: '#ffffff',
            borderRadius: 20,
            padding: 18,
            border: '1px solid rgba(226, 232, 240, 0.9)',
            boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.04)'
          }}
        >
          <form onSubmit={handleSubmit} noValidate>
            {/* Inline 3-Column Inputs: Tanggal, Jam Mulai, Jam Selesai */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 12 }}>
              <div>
                <label htmlFor="tgl_lembur" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, display: 'block' }}>
                  Tanggal
                </label>
                <input
                  id="tgl_lembur"
                  type="date"
                  max={todayMax}
                  value={tgl}
                  onChange={(e) => setTgl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    background: '#ffffff'
                  }}
                />
                {errors.tgl && <div style={{ color: '#ef4444', fontSize: 10, marginTop: 2 }}>{errors.tgl}</div>}
              </div>

              <div>
                <label htmlFor="waktu_mulai" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, display: 'block' }}>
                  Mulai
                </label>
                <input
                  id="waktu_mulai"
                  type="time"
                  value={jamAwal}
                  onChange={(e) => setJamAwal(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    background: '#ffffff'
                  }}
                />
                {errors.jam_awal && <div style={{ color: '#ef4444', fontSize: 10, marginTop: 2 }}>{errors.jam_awal}</div>}
              </div>

              <div>
                <label htmlFor="waktu_selesai" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, display: 'block' }}>
                  Selesai
                </label>
                <input
                  id="waktu_selesai"
                  type="time"
                  value={jamSelesai}
                  onChange={(e) => setJamSelesai(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    background: '#ffffff'
                  }}
                />
                {errors.jam_selesai && <div style={{ color: '#ef4444', fontSize: 10, marginTop: 2 }}>{errors.jam_selesai}</div>}
              </div>
            </div>

            {/* Live Duration Mini Chip */}
            {liveDurasi && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                background: '#eff6ff',
                color: '#2563eb',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                marginBottom: 12
              }}>
                <IconClock style={{ width: 13, height: 13 }} />
                <span>Estimasi Durasi: {liveDurasi}</span>
              </div>
            )}

            {/* Uraian Pekerjaan */}
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="alasan_lembur" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, display: 'block' }}>
                Pekerjaan Lembur
              </label>
              <textarea
                id="alasan_lembur"
                rows="2"
                placeholder="Cth: Rekap stok opname, maintenance server..."
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  background: '#ffffff'
                }}
              />
              {errors.alasan && <div style={{ color: '#ef4444', fontSize: 10, marginTop: 2 }}>{errors.alasan}</div>}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: 14,
                background: 'var(--grad-primary)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: '0 6px 16px -2px var(--accent-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.2s ease'
              }}
            >
              <IconClock style={{ width: 16, height: 16 }} />
              <span>{submitting ? 'Menyimpan...' : 'Kirim Data Lembur'}</span>
            </button>
          </form>
        </div>
      )}

      {/* ===== TAB 2: RIWAYAT & KALENDER ===== */}
      {tab === 'riwayat' && (
        <div key="riwayat" className="subtab-spring-enter">
          {/* Sub Toolbar Row 1: List vs Kalender & Filter Bulan */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 8,
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 10 }}>
              <button
                type="button"
                className={`segmented-pill-btn ${viewMode === 'list' ? 'active' : ''}`}
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'list' ? '#ffffff' : 'transparent',
                  color: viewMode === 'list' ? 'var(--accent)' : 'var(--text-muted)',
                  boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5
                }}
                onClick={() => setViewMode('list')}
              >
                <IconList style={{ width: 13, height: 13 }} />
                <span>List</span>
              </button>
              <button
                type="button"
                className={`segmented-pill-btn ${viewMode === 'grid' ? 'active' : ''}`}
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'grid' ? '#ffffff' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--accent)' : 'var(--text-muted)',
                  boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5
                }}
                onClick={() => setViewMode('grid')}
              >
                <IconCal style={{ width: 13, height: 13 }} />
                <span>Kalender</span>
              </button>
            </div>

            {viewMode === 'list' && bulanOptions.length > 0 && (
              <select
                value={bulanFilter}
                onChange={(e) => setBulanFilter(e.target.value)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  fontSize: 11,
                  fontWeight: 600,
                  background: '#ffffff',
                  fontFamily: 'inherit'
                }}
              >
                <option value="semua">Semua Periode</option>
                {bulanOptions.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
          </div>

          {/* Sub Toolbar Row 2: Sort & Grouping Controls (Hanya saat List View) */}
          {viewMode === 'list' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 12,
              background: '#ffffff',
              padding: '6px 12px',
              borderRadius: 12,
              border: '1px solid rgba(226, 232, 240, 0.9)',
              boxShadow: 'var(--shadow-xs)'
            }}>
              {/* Sort Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                <IconSort style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-heading)',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    outline: 'none',
                    padding: 0
                  }}
                >
                  <option value="date-desc">Urutkan: Terbaru</option>
                  <option value="date-asc">Urutkan: Terlama</option>
                  <option value="durasi-desc">Urutkan: Durasi Terbanyak</option>
                  <option value="durasi-asc">Urutkan: Durasi Terkecil</option>
                </select>
              </div>

              {/* Vertical divider */}
              <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

              {/* Group Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                <IconLayers style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-heading)',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    outline: 'none',
                    padding: 0
                  }}
                >
                  <option value="bulan">Grup: Per Bulan</option>
                  <option value="status">Grup: Per Status</option>
                  <option value="none">Grup: Tanpa Grup</option>
                </select>
              </div>
            </div>
          )}

          {viewMode === 'list' ? renderList() : renderKalender()}
        </div>
      )}

      {/* Date Detail Modal */}
      <Modal
        open={!!modalLembur}
        title={modalLembur?.dateStr || ''}
        alignLeft
        onClose={() => setModalLembur(null)}
      >
        {modalLembur?.records?.map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-soft)' }}>
            <div>
              <strong style={{ fontSize: 13, color: 'var(--text-heading)' }}>{r.nama || '-'}</strong>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.jam_awal} - {r.jam_selesai}</div>
            </div>
            <span className="badge-pill badge-pill--approved">{formatJam(r.durasi)}</span>
          </div>
        ))}
        <div className="modal-btns" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" style={{ width: '100%', borderRadius: 14 }} onClick={() => setModalLembur(null)}>Tutup</button>
        </div>
      </Modal>

      {/* Alert / Confirm Modal */}
      <Modal
        open={!!modal}
        title={modal?.title}
        icon={modal?.icon}
        msg={modal?.msg}
        onClose={modal?.type === 'alert' ? closeModal : undefined}
      >
        {modal?.type === 'alert' && (
          <div className="modal-btns">
            <button className="btn btn-primary" style={{ width: '100%', borderRadius: 14 }} onClick={closeModal}>OK Mengerti</button>
          </div>
        )}
        {modal?.type === 'confirm' && (
          <div className="modal-btns" style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1, borderRadius: 14 }} onClick={closeModal}>Batal</button>
            <button className="btn btn-primary" style={{ flex: 1, borderRadius: 14 }} onClick={doSubmit}>Yakin, Kirim</button>
          </div>
        )}
      </Modal>
    </div>
  );

  // ===== Render Kalender Grid (Bisa Digeser Antar Bulan) =====
  function renderKalender() {
    const calYear = calDate.getFullYear();
    const calMonth = calDate.getMonth();
    const bulanStr = `${NAMA_BULAN[calMonth]} ${calYear}`;
    const currentMonthData = historyLembur.filter((r) => r.bulan_lembur === bulanStr);
    const approvedInCalMonth = currentMonthData.filter((r) => ['DISETUJUI', 'IZIN_DIBERIKAN'].includes((r.status || '').toUpperCase()));
    const totalJamInCal = parseFloat(approvedInCalMonth.reduce((acc, r) => acc + (parseFloat(r.durasi) || 0), 0).toFixed(1));
    const isCurrentMonthNow = calYear === now.getFullYear() && calMonth === now.getMonth();

    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
    let firstDay = new Date(curYear, curMonth, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1; // Senin = 0

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(<div className="cal-day empty" key={`e${i}`} />);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const records = currentMonthData.filter((r) => r.tanggal_lembur === dateStr);
      const hasData = records.length > 0;
      cells.push(
        <div
          className={`cal-day${hasData ? ' has-data' : ''}`}
          key={day}
          onClick={hasData ? () => setModalLembur({ dateStr, records }) : undefined}
          style={{ cursor: hasData ? 'pointer' : 'default' }}
        >
          <span className="cal-date-num">{day}</span>
          <span className={`cal-badge ${hasData ? 'red' : 'zero'}`}>{records.length}</span>
        </div>
      );
    }

    return (
      <div
        key={`${calYear}-${calMonth}`}
        className="subtab-spring-enter"
        style={{
          background: '#ffffff',
          borderRadius: 20,
          padding: '16px 14px',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          boxShadow: 'var(--shadow-xs)'
        }}
      >
        {/* Navigation Bar Kalender (Geser Bulan) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12
        }}>
          <button
            type="button"
            onClick={prevMonth}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: '#f1f5f9',
              border: 'none',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-heading)',
              transition: 'all 0.2s ease'
            }}
            title="Bulan Sebelumnya"
          >
            <IconChevronLeft style={{ width: 16, height: 16 }} />
          </button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-heading)' }}>
              {bulanStr}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              {totalJamInCal} Jam ACC ({currentMonthData.length} Sesi)
            </div>
            {!isCurrentMonthNow && (
              <button
                type="button"
                onClick={resetToCurrentMonth}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 0 0',
                  textDecoration: 'underline'
                }}
              >
                Lompat ke Bulan Ini
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={nextMonth}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: '#f1f5f9',
              border: 'none',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-heading)',
              transition: 'all 0.2s ease'
            }}
            title="Bulan Berikutnya"
          >
            <IconChevronRight style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div className="calendar-container">
          <div className="calendar-header">
            <div>Sn</div><div>Sl</div><div>Rb</div><div>Km</div><div>Jm</div><div>Sb</div><div>Mg</div>
          </div>
          <div className="calendar-grid">{cells}</div>
        </div>
      </div>
    );
  }

  // ===== Render List Riwayat (Dengan Fitur Sort & Group) =====
  function renderList() {
    // 1. Filter periode
    const filtered = historyLembur.filter((r) => {
      const okBulan = bulanFilter === 'semua' || r.bulan_lembur === bulanFilter;
      return okBulan;
    });

    if (filtered.length === 0) {
      return (
        <div style={{
          background: '#ffffff',
          borderRadius: 20,
          padding: '28px 16px',
          textAlign: 'center',
          border: '1px solid rgba(226, 232, 240, 0.9)'
        }}>
          <IconInbox style={{ width: 28, height: 28, color: 'var(--text-faint)', marginBottom: 6 }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>Belum Ada Riwayat</div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Data lembur Anda akan terdaftar di sini.
          </p>
        </div>
      );
    }

    // 2. Sort records
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'date-desc') {
        return (b.tanggal_lembur || '').localeCompare(a.tanggal_lembur || '');
      }
      if (sortBy === 'date-asc') {
        return (a.tanggal_lembur || '').localeCompare(b.tanggal_lembur || '');
      }
      if (sortBy === 'durasi-desc') {
        return (parseFloat(b.durasi) || 0) - (parseFloat(a.durasi) || 0);
      }
      if (sortBy === 'durasi-asc') {
        return (parseFloat(a.durasi) || 0) - (parseFloat(b.durasi) || 0);
      }
      return 0;
    });

    // 3. Group records
    let groups = [];
    if (groupBy === 'none') {
      groups = [{ key: 'all', title: null, items: sorted }];
    } else if (groupBy === 'bulan') {
      const map = new Map();
      sorted.forEach((item) => {
        const m = item.bulan_lembur || 'Periode Lain';
        if (!map.has(m)) map.set(m, []);
        map.get(m).push(item);
      });
      groups = Array.from(map.entries()).map(([m, groupItems]) => {
        const approvedItems = groupItems.filter((r) => ['DISETUJUI', 'IZIN_DIBERIKAN'].includes((r.status || '').toUpperCase()));
        const totalDur = approvedItems.reduce((acc, r) => acc + (parseFloat(r.durasi) || 0), 0);
        return {
          key: m,
          title: `📅 ${m}`,
          items: groupItems,
          totalJam: parseFloat(totalDur.toFixed(1)),
          count: groupItems.length,
        };
      });
    } else if (groupBy === 'status') {
      const statusMeta = [
        { key: 'DISETUJUI', title: '✅ Disetujui' },
        { key: 'PENDING', title: '⏳ Menunggu ACC' },
        { key: 'DITOLAK', title: '❌ Ditolak' },
      ];
      const map = new Map();
      statusMeta.forEach((s) => map.set(s.key, []));

      sorted.forEach((item) => {
        const raw = (item.status || 'PENDING').toUpperCase();
        const norm = (raw === 'IZIN_DIBERIKAN' || raw === 'DISETUJUI') ? 'DISETUJUI' : raw === 'DITOLAK' ? 'DITOLAK' : 'PENDING';
        if (!map.has(norm)) map.set(norm, []);
        map.get(norm).push(item);
      });

      groups = statusMeta
        .filter((s) => (map.get(s.key) || []).length > 0)
        .map((s) => {
          const groupItems = map.get(s.key);
          const totalDur = groupItems.reduce((acc, r) => acc + (parseFloat(r.durasi) || 0), 0);
          return {
            key: s.key,
            title: s.title,
            items: groupItems,
            totalJam: parseFloat(totalDur.toFixed(1)),
            count: groupItems.length,
          };
        });
    }

    return (
      <div key={`list-${bulanFilter}-${sortBy}-${groupBy}`} className="subtab-spring-enter" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.map((group) => (
          <div key={group.key}>
            {/* Group Header */}
            {group.title && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                background: '#f8fafc',
                borderRadius: 12,
                marginBottom: 6,
                border: '1px solid #f1f5f9'
              }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-heading)' }}>
                  {group.title}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                  {group.totalJam} Jam ACC • {group.count} Sesi
                </span>
              </div>
            )}

            {/* Group Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.items.map((r) => {
                const status = (r.status || 'PENDING').toUpperCase();
                const isAppr = status === 'DISETUJUI' || status === 'IZIN_DIBERIKAN';
                const isRej = status === 'DITOLAK';
                return (
                  <div
                    key={r.id}
                    className="spring-list-item"
                    style={{
                      background: '#ffffff',
                      borderRadius: 16,
                      padding: '12px 14px',
                      border: '1px solid rgba(226, 232, 240, 0.9)',
                      boxShadow: 'var(--shadow-xs)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10
                    }}
                  >
                    <div className="squircle-badge-green" style={{
                      width: 36,
                      height: 36,
                      borderRadius: 11,
                      background: isAppr ? '#ecfdf5' : isRej ? '#fef2f2' : '#fffbeb',
                      color: isAppr ? '#059669' : isRej ? '#dc2626' : '#d97706',
                      flexShrink: 0
                    }}>
                      <IconClock style={{ width: 17, height: 17 }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-heading)' }}>
                          Lembur ({formatJam(r.durasi)})
                        </div>
                        <span className={`badge-pill badge-pill--${isAppr ? 'approved' : isRej ? 'rejected' : 'pending'}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                          {status === 'IZIN_DIBERIKAN' ? 'DISETUJUI' : status}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        <span>📅 {r.tanggal_lembur}</span>
                        <span>•</span>
                        <span>⏰ {r.jam_awal}–{r.jam_selesai}</span>
                      </div>

                      {r.alasan && (
                        <div style={{ fontSize: 11, color: 'var(--text-dark)', marginTop: 4, background: '#f8fafc', padding: '6px 10px', borderRadius: 8 }}>
                          "{r.alasan}"
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }
}
