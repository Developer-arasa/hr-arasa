import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import Loading from '../components/Loading';
import {
  IconPen, IconFolder, IconIllness,
  IconWarn, IconCal, IconInbox, IconUser,
} from '../components/Icons';
import { z } from 'zod';

const izinSchema = z.object({
  kategori: z.string().min(1, 'Pilih kategori izin'),
  tgl_mulai: z.string().min(1, 'Tanggal mulai wajib diisi'),
  tgl_akhir: z.string().min(1, 'Tanggal akhir wajib diisi'),
  alasan: z.string().min(1, 'Alasan wajib diisi'),
});

export default function Izin() {
  const user = useAuthStore((s) => s.user);

  const [tab, setTab] = useState('pengajuan');
  const [kategori, setKategori] = useState('');
  const [tglMulai, setTglMulai] = useState('');
  const [tglAkhir, setTglAkhir] = useState('');
  const [alasan, setAlasan] = useState('');

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [modal, setModal] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('data_izin')
      .select('*')
      .eq('id_karyawan', user.id_karyawan)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setHistory(data || []);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [user.id_karyawan]);

  function showAlert(msg, icon = 'bell') {
    setModal({ type: 'alert', msg, icon });
  }
  function closeModal() {
    setModal(null);
  }

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

    const riwayat = history.filter((h) => h.id_karyawan == user.id_karyawan);
    const hasOverlap = riwayat.some((h) => {
      const extMulai = h.tanggal_izin_mulai;
      const extAkhir = h.tanggal_izin_akhir || h.tanggal_izin_mulai;
      return (tglMulai <= extAkhir) && (tglAkhir >= extMulai);
    });

    if (hasOverlap) {
      showAlert('Anda sudah memiliki pengajuan izin pada rentang tanggal tersebut. Hubungi HRD jika ingin mengubah/membatalkan data.', 'error');
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
      const { error } = await supabase.from('data_izin').insert([payload]);
      if (error) throw error;

      const waTanggal = tglMulai === tglAkhir ? tglMulai : `${tglMulai} s/d ${tglAkhir}`;
      const waText = `Halo kak elok, aku mohon ${kategori} di ${waTanggal} karena ${alasan}, mohon untuk segera memberikan keputusan, terima kasih!`;

      setModal({ type: 'alert', icon: 'success', msg: 'Berhasil! Anda akan dialihkan ke WhatsApp untuk memberitahu HRD.' });
      setTimeout(() => {
        window.location.href = `https://wa.me/${import.meta.env.VITE_WA_HRD}?text=${encodeURIComponent(waText)}`;
      }, 2000);
    } catch {
      setModal({ type: 'alert', icon: 'error', msg: 'Gagal terhubung ke server. Silakan coba lagi nanti.' });
    } finally {
      setSubmitting(false);
    }
  }

  const initial = (user?.nama_karyawan || 'K')[0].toUpperCase();
  const dayCount = (() => {
    if (!tglMulai || !tglAkhir || tglAkhir < tglMulai) return 0;
    const a = new Date(tglMulai);
    const b = new Date(tglAkhir);
    return Math.round((b - a) / 86400000) + 1;
  })();

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Pengajuan Izin</h1>
        <p className="page-subtitle">Ajukan izin sakit, izin, atau abnormal case.</p>
      </div>

      <div className="card">
        <div className="tab-nav">
          <button className={`tab-btn${tab === 'pengajuan' ? ' active' : ''}`} onClick={() => setTab('pengajuan')}>
            <IconPen /> Pengajuan
          </button>
          <button className={`tab-btn${tab === 'riwayat' ? ' active' : ''}`} onClick={() => setTab('riwayat')}>
            <IconFolder /> Riwayat
          </button>
        </div>

        {tab === 'pengajuan' && (
        <form onSubmit={handleSubmit} noValidate>
          <div className="identity-banner">
            <div className="identity-avatar">{initial}</div>
            <div className="identity-info">
              <div className="identity-name">{user?.nama_karyawan || 'Karyawan'}</div>
              <div className="identity-sub">
                {user?.jabatan || user?.departemen || 'Karyawan'} · ID {user?.id_karyawan || '-'}
              </div>
            </div>
            <span className="identity-tag">Ter-verifikasi</span>
          </div>

          <div className="form-group">
            <label className="form-label">Kategori Izin</label>
            <div className="pill-group">
              {[
                { val: 'Sakit', icon: IconIllness, label: 'Sakit' },
                { val: 'Izin', icon: IconPen, label: 'Izin' },
                { val: 'Abnormal case', icon: IconWarn, label: 'Abnormal case' },
              ].map((opt) => (
                <div
                  key={opt.val}
                  className={`pill-option${kategori === opt.val ? ' active' : ''}`}
                  onClick={() => { setKategori(opt.val); setErrors((e) => ({ ...e, kategori: '' })); }}
                >
                  <span className="pill-option__icon"><opt.icon /></span>
                  {opt.label}
                </div>
              ))}
            </div>
            {errors.kategori && <div className="form-hint" style={{ color: '#ef4444' }}>{errors.kategori}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="tgl_mulai">Tanggal Mulai</label>
              <input
                id="tgl_mulai"
                type="date"
                className={`form-input${errors.tgl_mulai ? ' input-error' : ''}`}
                value={tglMulai}
                onChange={(e) => setTglMulai(e.target.value)}
              />
              {errors.tgl_mulai && <div className="form-hint" style={{ color: '#ef4444' }}>{errors.tgl_mulai}</div>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="tgl_akhir">Tanggal Akhir</label>
              <input
                id="tgl_akhir"
                type="date"
                className={`form-input${errors.tgl_akhir ? ' input-error' : ''}`}
                value={tglAkhir}
                onChange={(e) => setTglAkhir(e.target.value)}
              />
              {errors.tgl_akhir && <div className="form-hint" style={{ color: '#ef4444' }}>{errors.tgl_akhir}</div>}
            </div>
          </div>

          {tglMulai && tglAkhir && tglAkhir >= tglMulai && (
            <div className="day-count">
              <span className="day-count__icon"><IconCal /></span>
              {dayCount} {dayCount === 1 ? 'Hari' : 'Hari'} izin
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="alasan">Detail Alasan</label>
            <textarea
              id="alasan"
              rows="3"
              className={`form-textarea${errors.alasan ? ' input-error' : ''}`}
              placeholder="Jelaskan alasan izin Anda..."
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
            />
            {errors.alasan && <div className="form-hint" style={{ color: '#ef4444' }}>{errors.alasan}</div>}
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Mengirim Data...' : 'Kirim Pengajuan'}
          </button>
        </form>
        )}

        {tab === 'riwayat' && (
        <div>
        {loading ? (
          <Loading lines={4} />
        ) : history.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon"><IconInbox /></span>
            Belum ada riwayat izin tersimpan.
          </div>
        ) : (
          <>
            <div className="summary-strip">
              <div className="summary-chip">
                <span className="summary-chip__num">{history.length}</span>
                <span className="summary-chip__label">Total Pengajuan</span>
              </div>
              <div className="summary-chip">
                <span className="summary-chip__num">{history.filter((h) => (h.status || '').toUpperCase() === 'PENDING').length}</span>
                <span className="summary-chip__label">Menunggu</span>
              </div>
              <div className="summary-chip">
                <span className="summary-chip__num">{history.filter((h) => ['DISETUJUI', 'IZIN_DIBERIKAN'].includes((h.status || '').toUpperCase())).length}</span>
                <span className="summary-chip__label">Disetujui</span>
              </div>
            </div>
            {history.map((h) => {
              const status = h.status || 'PENDING';
              const statusClass = status.replace(/\s+/g, '_').toLowerCase();
              return (
                <div className="timeline-card" key={h.id}>
                  <div className="timeline-head">
                    <div className="timeline-title">{h.kategori_izin || '-'}</div>
                    <span className={`badge badge--${statusClass}`}>{status}</span>
                  </div>
                  <div className="timeline-meta">
                    <span><IconUser /> {h.nama || '-'} <span style={{ opacity: 0.6 }}>(#{h.id_karyawan || '-'})</span></span>
                    <span><IconCal /> {h.tanggal_izin_mulai || '-'} s/d {h.tanggal_izin_akhir || '-'}</span>
                  </div>
                  {h.alasan && <div className="timeline-row__sub" style={{ marginTop: '8px' }}>{h.alasan}</div>}
                </div>
              );
            })}
          </>
        )}
        </div>
        )}
      </div>

      <Modal
        open={!!modal}
        title={modal?.title}
        icon={modal?.icon}
        msg={modal?.msg}
        onClose={modal?.type === 'alert' ? closeModal : undefined}
      >
        {modal?.type === 'alert' && (
          <div className="modal-btns">
            <button className="btn btn-primary" style={{ width: 'auto', padding: '12px 24px' }} onClick={closeModal}>
              OK Mengerti
            </button>
          </div>
        )}
        {modal?.type === 'confirm' && (
          <>
            <div className="review-box">
              <div className="review-row">
                <span className="review-label">Kategori</span>
                <span className="review-value">{kategori}</span>
              </div>
              <div className="review-row">
                <span className="review-label">Tanggal</span>
                <span className="review-value">{tglMulai} s/d {tglAkhir}</span>
              </div>
              <div className="review-row">
                <span className="review-label">Durasi</span>
                <span className="review-value">{dayCount} Hari</span>
              </div>
              <div className="review-row">
                <span className="review-label">Alasan</span>
                <span className="review-value">{alasan}</span>
              </div>
            </div>
            <div className="modal-btns">
              <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={closeModal}>Batal</button>
              <button className="btn btn-primary" style={{ width: 'auto', padding: '12px 24px' }} onClick={doSubmit}>
                Yakin, Kirim
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

