import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { sendWhatsAppMessage } from '../lib/whatsapp';
import Modal from '../components/Modal';
import Loading from '../components/Loading';
import {
  IconPen, IconFolder, IconIllness,
  IconWarn, IconCal, IconInbox, IconUser,
  IconCheck, IconClock, IconChevronRight, IconChevronLeft,
  IconCalendarCheck, IconPlus, IconList
} from '../components/Icons';
import { z } from 'zod';

const izinSchema = z.object({
  kategori: z.string().min(1, 'Pilih kategori izin'),
  tgl_mulai: z.string().min(1, 'Tanggal mulai wajib diisi'),
  tgl_akhir: z.string().min(1, 'Tanggal akhir wajib diisi'),
  alasan: z.string().min(1, 'Alasan wajib diisi'),
});

function dayCount(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s) || isNaN(e)) return 0;
  return Math.max(1, Math.floor((e - s) / 86400000) + 1);
}

export default function Izin() {
  const user = useAuthStore((s) => s.user);

  const [tab, setTab] = useState('pengajuan'); // 'pengajuan' | 'riwayat'
  const [kategori, setKategori] = useState('Cuti Tahunan');
  const [tglMulai, setTglMulai] = useState('');
  const [tglAkhir, setTglAkhir] = useState('');
  const [alasan, setAlasan] = useState('');

  const [history, setHistory] = useState([]);
  const [jatahCuti, setJatahCuti] = useState(12);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [resHist, resMaster] = await Promise.all([
          supabase.from('data_izin').select('*').eq('id_karyawan', user.id_karyawan).order('created_at', { ascending: false }),
          supabase.from('master_data').select('jatah_cuti').eq('id_karyawan', user.id_karyawan).maybeSingle(),
        ]);
        if (!cancelled) {
          setHistory(resHist.data || []);
          if (resMaster.data?.jatah_cuti) setJatahCuti(resMaster.data.jatah_cuti);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    if (user?.id_karyawan) load();
    return () => { cancelled = true; };
  }, [user?.id_karyawan]);

  function showAlert(msg, icon = 'bell') {
    setModal({ type: 'alert', msg, icon });
  }
  function closeModal() {
    setModal(null);
  }

  const isApproved = (s) => ['DISETUJUI', 'IZIN_DIBERIKAN', 'IZIN DIBERIKAN'].includes((s || '').trim().toUpperCase());
  const approvedList = history.filter((h) => isApproved(h.status));
  // Sisa cuti = jatah_cuti - total hari izin disetujui (sinkron dengan Dashboard)
  const usedDays = approvedList.reduce((acc, r) => acc + dayCount(r.tanggal_izin_mulai, r.tanggal_izin_akhir), 0);
  const sisaCuti = Math.max(0, jatahCuti - usedDays);
  const pendingCount = history.filter((h) => (h.status || '').toUpperCase() === 'PENDING').length;

  // Ring calculations
  const cutiPct = jatahCuti > 0 ? Math.min(100, Math.round((sisaCuti / jatahCuti) * 100)) : 0;
  const usedPct = jatahCuti > 0 ? Math.min(100, Math.round((usedDays / jatahCuti) * 100)) : 0;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * cutiPct) / 100;

  const currentDuration = (() => {
    if (!tglMulai || !tglAkhir || tglAkhir < tglMulai) return 0;
    return dayCount(tglMulai, tglAkhir);
  })();

  function handleSubmit(e) {
    e.preventDefault();

    const parsed = izinSchema.safeParse({ kategori, tgl_mulai: tglMulai, tgl_akhir: tglAkhir, alasan });
    if (!parsed.success) {
      const fieldErrors = {};
      parsed.error.issues.forEach((i) => { fieldErrors[i.path[0]] = i.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    if (tglAkhir < tglMulai) {
      setErrors({ tgl_akhir: 'Tanggal akhir tidak boleh sebelum tanggal mulai' });
      return;
    }

    const STATUS_AKTIF = ['PENDING', 'DISETUJUI', 'IZIN_DIBERIKAN'];
    const riwayatAktif = history.filter(
      (h) => h.id_karyawan == user.id_karyawan && STATUS_AKTIF.includes((h.status || 'PENDING').toUpperCase()),
    );
    const hasOverlap = riwayatAktif.some((h) => {
      const extMulai = h.tanggal_izin_mulai;
      const extAkhir = h.tanggal_izin_akhir || h.tanggal_izin_mulai;
      return (tglMulai <= extAkhir) && (tglAkhir >= extMulai);
    });

    if (hasOverlap) {
      showAlert('Sudah ada pengajuan izin pada rentang tanggal tersebut.', 'error');
      return;
    }

    setModal({
      type: 'confirm',
      icon: 'question',
      title: 'Konfirmasi Pengajuan',
      msg: 'Apakah Anda yakin ingin mengirim pengajuan izin ini ke Admin HRD?',
    });
  }

  async function doSubmit() {
    closeModal();
    setSubmitting(true);

    const payload = {
      id_karyawan: user.id_karyawan,
      nama: user.nama_karyawan,
      tanggal_izin_mulai: tglMulai,
      tanggal_izin_akhir: tglAkhir,
      kategori_izin: kategori,
      alasan,
      status: 'PENDING',
    };

    try {
      const { data: existing } = await supabase
        .from('data_izin')
        .select('tanggal_izin_mulai, tanggal_izin_akhir')
        .eq('id_karyawan', user.id_karyawan)
        .in('status', ['PENDING', 'DISETUJUI', 'IZIN_DIBERIKAN']);
      const overlapLagi = (existing || []).some((h) => {
        const extMulai = h.tanggal_izin_mulai;
        const extAkhir = h.tanggal_izin_akhir || h.tanggal_izin_mulai;
        return (tglMulai <= extAkhir) && (tglAkhir >= extMulai);
      });
      if (overlapLagi) {
        setModal({ type: 'alert', icon: 'error', msg: 'Pengajuan izin pada rentang tanggal tersebut sudah ada.' });
        return;
      }

      const { error } = await supabase.from('data_izin').insert([payload]);
      if (error) throw error;

      // WhatsApp Hybrid notification
      const waTanggal = tglMulai === tglAkhir ? tglMulai : `${tglMulai} s/d ${tglAkhir}`;
      const waText = `Ada pengajuan izin ${kategori} oleh ${user.nama_karyawan} pada tanggal ${waTanggal} dengan alasan: ${alasan}. Mohon segera ditindaklanjuti.`;
      sendWhatsAppMessage({ message: waText });

      setTglMulai('');
      setTglAkhir('');
      setAlasan('');

      const { data: newHist } = await supabase
        .from('data_izin')
        .select('*')
        .eq('id_karyawan', user.id_karyawan)
        .order('created_at', { ascending: false });
      if (newHist) setHistory(newHist);

      setModal({ type: 'alert', icon: 'success', msg: 'Berhasil! Pengajuan izin terkirim ke HRD.' });
    } catch {
      setModal({ type: 'alert', icon: 'error', msg: 'Gagal terhubung ke server. Silakan coba lagi.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-enter" style={{ paddingBottom: 50 }}>
      {/* ===== HERO COMPACT FOCAL TRACKER ===== */}
      <div
        className="focal-hero-header"
        style={{
          background: 'linear-gradient(145deg, #1e3a8a 0%, #2563eb 50%, #10b981 100%)'
        }}
      >
        <div className="focal-top-bar">
          <Link to="/" className="focal-back-btn" title="Dashboard">
            <IconChevronLeft style={{ width: 16, height: 16 }} />
          </Link>
          <div className="focal-center-pill">
            <span>Tahun {new Date().getFullYear()}</span>
          </div>
          <div className="focal-right-badge">
            HAK CUTI
          </div>
        </div>

        {/* Compact Ring */}
        <div className="focal-donut-section">
          <div className="focal-ring-container">
            <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform: 'rotate(-90deg)' }}>
              <defs>
                <linearGradient id="focalCutiGradCompact" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a3e635" />
                  <stop offset="50%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#06b6d4" />
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
                stroke="url(#focalCutiGradCompact)"
                strokeWidth="9"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
            </svg>

            <div className="focal-ring-content">
              <div className="focal-ring-value">
                {sisaCuti} <span style={{ fontSize: 13, fontWeight: 700 }}>Hari</span>
              </div>
              <div className="focal-ring-sub">
                / Kuota {jatahCuti} Hari
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row on hero */}
        <div className="focal-bottom-row">
          <div>
            <div className="focal-active-text">Masa Berlaku Kuota</div>
            <div className="focal-active-val">s/d 31 Des {new Date().getFullYear()}</div>
          </div>
          <button
            type="button"
            className="focal-topup-btn"
            onClick={() => setTab('pengajuan')}
          >
            <IconPlus style={{ width: 13, height: 13 }} />
            <span>Ajukan Izin</span>
          </button>
        </div>
      </div>

      {/* ===== TWO COMPACT SUB-CARDS ("NUMPUK") ===== */}
      <div className="focal-overlap-grid">
        {/* Card 1: Cuti Terpakai */}
        <div className="focal-sub-card">
          <div className="focal-card-head">
            <div className="focal-card-title-group">
              <div className="squircle-badge-green" style={{ width: 30, height: 30, borderRadius: 10, background: '#dcfce7', color: '#15803d' }}>
                <IconCalendarCheck style={{ width: 16, height: 16 }} />
              </div>
              <div>
                <div className="focal-card-name" style={{ fontSize: 12 }}>Cuti Terpakai</div>
                <div className="focal-card-type">{approvedList.length} Disetujui</div>
              </div>
            </div>
            <span style={{ color: '#94a3b8', fontSize: 14 }}>···</span>
          </div>

          <div style={{ marginTop: 2 }}>
            <div className="focal-card-metric" style={{ fontSize: 16 }}>{usedDays} Hari</div>
            <div className="focal-progress-bar-wrap" style={{ height: 5, marginTop: 4 }}>
              <div
                className="focal-progress-bar-fill"
                style={{
                  width: `${usedPct}%`,
                  background: 'linear-gradient(90deg, #10b981, #06b6d4)'
                }}
              />
            </div>
            <div className="focal-progress-footer" style={{ marginTop: 4 }}>
              <span>{usedDays}/{jatahCuti} Hari</span>
              <span>{usedPct}%</span>
            </div>
          </div>
        </div>

        {/* Card 2: Menunggu ACC */}
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
            <div className="focal-card-metric" style={{ fontSize: 16 }}>{pendingCount} Pengajuan</div>
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
              <span>{history.length} Total Riwayat</span>
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
        marginBottom: 16
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
          <span>Ajukan Izin</span>
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
          <span>Riwayat ({history.length})</span>
        </button>
      </div>

      {/* ===== TAB 1: FORM PENGAJUAN (COMPACT & RINGKAS) ===== */}
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
            {/* Kategori Chips */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 6, display: 'block' }}>
                Jenis Izin
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 }}>
                {[
                  { val: 'Cuti Tahunan', icon: IconCalendarCheck, label: 'Cuti Tahunan' },
                  { val: 'Sakit', icon: IconIllness, label: 'Sakit' },
                  { val: 'Izin', icon: IconPen, label: 'Keperluan' },
                  { val: 'Abnormal case', icon: IconWarn, label: 'Khusus' },
                ].map((opt) => {
                  const isSel = kategori === opt.val;
                  return (
                    <div
                      key={opt.val}
                      onClick={() => { setKategori(opt.val); setErrors((e) => ({ ...e, kategori: '' })); }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: `1.5px solid ${isSel ? 'var(--accent)' : '#f1f5f9'}`,
                        background: isSel ? '#eff6ff' : '#f8fafc',
                        color: isSel ? 'var(--accent)' : 'var(--text-dark)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <opt.icon style={{ width: 15, height: 15, color: isSel ? 'var(--accent)' : '#94a3b8' }} />
                      <span>{opt.label}</span>
                    </div>
                  );
                })}
              </div>
              {errors.kategori && <div style={{ color: '#ef4444', fontSize: 10, marginTop: 2 }}>{errors.kategori}</div>}
            </div>

            {/* Date Pickers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label htmlFor="tgl_mulai" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, display: 'block' }}>
                  Tanggal Mulai
                </label>
                <input
                  id="tgl_mulai"
                  type="date"
                  value={tglMulai}
                  onChange={(e) => setTglMulai(e.target.value)}
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
                {errors.tgl_mulai && <div style={{ color: '#ef4444', fontSize: 10, marginTop: 2 }}>{errors.tgl_mulai}</div>}
              </div>

              <div>
                <label htmlFor="tgl_akhir" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, display: 'block' }}>
                  Tanggal Akhir
                </label>
                <input
                  id="tgl_akhir"
                  type="date"
                  value={tglAkhir}
                  onChange={(e) => setTglAkhir(e.target.value)}
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
                {errors.tgl_akhir && <div style={{ color: '#ef4444', fontSize: 10, marginTop: 2 }}>{errors.tgl_akhir}</div>}
              </div>
            </div>

            {/* Live Duration Mini Chip */}
            {currentDuration > 0 && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                background: '#ecfdf5',
                color: '#059669',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                marginBottom: 12
              }}>
                <IconCal style={{ width: 13, height: 13 }} />
                <span>Estimasi Durasi: {currentDuration} Hari Izin</span>
              </div>
            )}

            {/* Detail Alasan */}
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="alasan" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, display: 'block' }}>
                Keterangan / Alasan
              </label>
              <textarea
                id="alasan"
                rows="2"
                placeholder="Tuliskan alasan pengajuan untuk HRD..."
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
              <IconPen style={{ width: 16, height: 16 }} />
              <span>{submitting ? 'Mengirim...' : 'Kirim Pengajuan Izin'}</span>
            </button>
          </form>
        </div>
      )}

      {/* ===== TAB 2: RIWAYAT PENGAJUAN ===== */}
      {tab === 'riwayat' && (
        <div key="riwayat" className="subtab-spring-enter">
          {loading ? (
            <Loading lines={3} />
          ) : history.length === 0 ? (
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
                Pengajuan izin Anda akan tercatat di sini.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((h) => {
                const status = (h.status || 'PENDING').toUpperCase();
                const isAppr = status === 'DISETUJUI' || status === 'IZIN_DIBERIKAN';
                const isRej = status === 'DITOLAK';
                const durasiHari = dayCount(h.tanggal_izin_mulai, h.tanggal_izin_akhir);

                return (
                  <div
                    key={h.id}
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
                      <IconCalendarCheck style={{ width: 17, height: 17 }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-heading)' }}>
                          {h.kategori_izin || 'Izin'} ({durasiHari} Hari)
                        </div>
                        <span className={`badge-pill badge-pill--${isAppr ? 'approved' : isRej ? 'rejected' : 'pending'}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                          {status === 'IZIN_DIBERIKAN' ? 'DISETUJUI' : status}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        <span>📅 {h.tanggal_izin_mulai} {h.tanggal_izin_akhir && h.tanggal_izin_akhir !== h.tanggal_izin_mulai ? `s/d ${h.tanggal_izin_akhir}` : ''}</span>
                      </div>

                      {h.alasan && (
                        <div style={{ fontSize: 11, color: 'var(--text-dark)', marginTop: 4, background: '#f8fafc', padding: '6px 10px', borderRadius: 8 }}>
                          "{h.alasan}"
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
}
