import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import Loading from '../components/Loading';
import { IconClock, IconChart, IconList, IconCal, IconInbox } from '../components/Icons';
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
  tgl: z.string().min(1, 'Tanggal lembur wajib diisi'),
  jam_awal: z.string().min(1, 'Jam mulai wajib diisi'),
  jam_selesai: z.string().min(1, 'Jam selesai wajib diisi'),
  alasan: z.string().min(1, 'Pekerjaan lembur wajib diisi'),
});

export default function Lembur() {
  const user = useAuthStore((s) => s.user);
  const initial = (user?.nama_karyawan || '?').trim().charAt(0).toUpperCase();

  const [tgl, setTgl] = useState('');
  const [jamAwal, setJamAwal] = useState('');
  const [jamSelesai, setJamSelesai] = useState('');
  const [alasan, setAlasan] = useState('');

  const [historyLembur, setHistoryLembur] = useState([]);
  const bulanOptions = [...new Set((historyLembur || []).map((r) => r.bulan_lembur).filter(Boolean))].sort();
  const [tab, setTab] = useState('pengajuan');
  const [viewMode, setViewMode] = useState('list');
  const [bulanFilter, setBulanFilter] = useState('semua');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState(null);
  const [modalLembur, setModalLembur] = useState(null); // { dateStr, records }

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

    // Validasi tanggal tidak di masa depan
    const inputDate = new Date(tgl);
    const today = new Date();
    inputDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    if (inputDate > today) {
      showAlert('Tidak bisa mengajukan lembur untuk hari esok atau tanggal di masa depan!', 'error');
      return;
    }

    // Validasi duplikat
    const cekDuplikat = historyLembur.find((h) => h.id_karyawan == user.id_karyawan && h.tanggal_lembur == tgl);
    if (cekDuplikat) {
      showAlert(`Anda sudah melakukan input lembur pada tanggal ${tgl}. Hubungi HRD jika ingin revisi.`, 'error');
      return;
    }

    setModal({
      type: 'confirm',
      icon: 'question',
      title: 'Konfirmasi',
      msg: 'Pastikan durasi jam lembur sudah benar. Lanjutkan kirim data?',
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
      id_karyawan: user.id_karyawan,
      nama: user.nama_karyawan,
      tanggal_lembur: tgl,
      jam_awal: jamAwal,
      jam_selesai: jamSelesai,
      durasi: durasiDec,
      alasan,
      bulan_lembur: bulanStr,
      status: 'PENDING',
    };

    try {
      const { error } = await supabase.from('data_lembur').insert([payload]);
      if (error) throw error;
      setModal({ type: 'alert', icon: 'success', msg: 'Mantap! Data lembur berhasil dikirim dan menunggu persetujuan HRD.' });
      setTimeout(() => { window.location.reload(); }, 2000);
    } catch {
      setModal({ type: 'alert', icon: 'error', msg: 'Gagal terhubung ke server. Silakan coba lagi nanti.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Input Data Lembur</h1>
        <p className="page-subtitle">Catat jam lembur kamu setiap harinya.</p>
      </div>

      <div className="card">
        <div className="tab-nav">
          <button className={`tab-btn${tab === 'pengajuan' ? ' active' : ''}`} onClick={() => setTab('pengajuan')}>
            <IconClock /> Pengajuan
          </button>
          <button className={`tab-btn${tab === 'riwayat' ? ' active' : ''}`} onClick={() => setTab('riwayat')}>
            <IconChart /> Riwayat
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
            <label className="form-label" htmlFor="tgl_lembur">Tanggal Lembur (Maksimal Hari Ini)</label>
            <input
              id="tgl_lembur"
              type="date"
              max={todayMax}
              className={`form-input${errors.tgl ? ' input-error' : ''}`}
              value={tgl}
              onChange={(e) => setTgl(e.target.value)}
            />
            {errors.tgl && <div className="form-hint" style={{ color: '#ef4444' }}>{errors.tgl}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="waktu_mulai">Jam Mulai</label>
              <input
                id="waktu_mulai"
                type="time"
                className={`form-input${errors.jam_awal ? ' input-error' : ''}`}
                value={jamAwal}
                onChange={(e) => setJamAwal(e.target.value)}
              />
              {errors.jam_awal && <div className="form-hint" style={{ color: '#ef4444' }}>{errors.jam_awal}</div>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="waktu_selesai">Jam Selesai</label>
              <input
                id="waktu_selesai"
                type="time"
                className={`form-input${errors.jam_selesai ? ' input-error' : ''}`}
                value={jamSelesai}
                onChange={(e) => setJamSelesai(e.target.value)}
              />
              {errors.jam_selesai && <div className="form-hint" style={{ color: '#ef4444' }}>{errors.jam_selesai}</div>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="alasan_lembur">Pekerjaan Lembur (Alasan)</label>
            <textarea
              id="alasan_lembur"
              rows="2"
              className={`form-textarea${errors.alasan ? ' input-error' : ''}`}
              placeholder="Cth: Rekap stok, membersihkan area..."
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
            />
            {errors.alasan && <div className="form-hint" style={{ color: '#ef4444' }}>{errors.alasan}</div>}
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Menyimpan Data...' : 'Kirim Data Lembur'}
          </button>
        </form>
        )}

        {tab === 'riwayat' && (
        <div>
          <div className="riwayat-toolbar">
            <div className="tab-nav">
              <button className={`tab-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')}><IconList /> List</button>
              <button className={`tab-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')}><IconCal /> Grid</button>
            </div>

            {viewMode === 'list' && (
              <select
                className="form-input"
                style={{ width: 'auto', minWidth: '160px' }}
                value={bulanFilter}
                onChange={(e) => setBulanFilter(e.target.value)}
              >
                <option value="semua">Semua Bulan</option>
                {bulanOptions.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
          </div>

          {viewMode === 'list' ? renderList() : renderKalender()}
        </div>
        )}
      </div>

      <Modal
        open={!!modalLembur}
        title={modalLembur?.dateStr || ''}
        alignLeft
        onClose={() => setModalLembur(null)}
      >
        {modalLembur?.records?.map((r) => (
          <div key={r.id} className="acc-row">
            <div>
              <strong>{r.nama || '-'}</strong>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.jam_awal} - {r.jam_selesai}</div>
            </div>
            <span className="kategori-tag">{formatJam(r.durasi)}</span>
          </div>
        ))}
        <div className="modal-btns" style={{ marginTop: '16px' }}>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '12px 24px' }} onClick={() => setModalLembur(null)}>Tutup</button>
        </div>
      </Modal>

      <Modal
        open={!!modal}
        title={modal?.title}
        icon={modal?.icon}
        msg={modal?.msg}
        onClose={modal?.type === 'alert' ? closeModal : undefined}
      >
        {modal?.type === 'alert' && (
          <div className="modal-btns">
            <button className="btn btn-primary" style={{ width: 'auto', padding: '12px 24px' }} onClick={closeModal}>OK Mengerti</button>
          </div>
        )}
        {modal?.type === 'confirm' && (
          <div className="modal-btns">
            <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={closeModal}>Batal</button>
            <button className="btn btn-primary" style={{ width: 'auto', padding: '12px 24px' }} onClick={doSubmit}>Yakin, Kirim</button>
          </div>
        )}
      </Modal>
    </>
  );

  // ===== Render Kalender =====
  function renderKalender() {
    const now = new Date();

    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const bulanStr = `${NAMA_BULAN[curMonth]} ${curYear}`;
    const currentMonthData = historyLembur.filter((r) => r.bulan_lembur === bulanStr);

    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
    let firstDay = new Date(curYear, curMonth, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;

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
        >
          <span className="cal-date-num">{day}</span>
          <span className={`cal-badge ${hasData ? 'red' : 'zero'}`}>{records.length} </span>
        </div>
      );
    }

    return (
      <div className="calendar-container">
        <div className="calendar-title">{bulanStr}</div>
        <div className="calendar-header">
          <div>Sn</div><div>Sl</div><div>Rb</div><div>Km</div><div>Jm</div><div>Sb</div><div>Mg</div>
        </div>
        <div className="calendar-grid">{cells}</div>
      </div>
    );
  }

  // ===== Render List =====
  function renderList() {
    const data = historyLembur.filter((r) => {
      const okBulan = bulanFilter === 'semua' || r.bulan_lembur === bulanFilter;
      return okBulan;
    });

    if (data.length === 0) {
      return (
        <div className="empty-state">
          <span className="empty-state__icon"><IconInbox /></span>
          Belum ada riwayat lembur.
        </div>
      );
    }

    return (
      <div>
        {data.map((r) => (
          <div className="timeline-card" key={r.id}>
            <div className="timeline-head">
              <div className="timeline-title"><IconCal /> {r.tanggal_lembur}</div>
              <span className={`badge badge--${(r.status || 'pending').toLowerCase()}`}>
                {r.status || 'PENDING'}
              </span>
            </div>
            <div className="timeline-row">
              <div className="timeline-row__main">
                <span>⏰ {r.jam_awal} – {r.jam_selesai}</span>
                <span className="timeline-row__sub">{r.bulan_lembur}</span>
              </div>
              <span className="kategori-tag">{formatJam(r.durasi)}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }
}

