import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import Loading from '../components/Loading';

function formatJam(durasi) {
  const totalMenit = Math.round(parseFloat(durasi) * 60);
  if (!totalMenit || isNaN(totalMenit)) return '0 Menit';
  const j = Math.floor(totalMenit / 60);
  const m = totalMenit % 60;
  if (j > 0 && m > 0) return `${j} Jam ${m} Menit`;
  if (j > 0) return `${j} Jam`;
  return `${m} Menit`;
}

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);

  const [summary, setSummary] = useState({ totalLembur: 0, jmlLembur: 0, sisaIzin: 0, izinTerakhir: null });
  const [pengumuman, setPengumuman] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const now = new Date();
        const bulanStr = `${NAMA_BULAN[now.getMonth()]} ${now.getFullYear()}`;

        const [resLembur, resIzin, resPengumuman] = await Promise.all([
          supabase.from('data_lembur').select('*').eq('id_karyawan', user.id_karyawan).eq('status', 'DISETUJUI').eq('bulan_lembur', bulanStr),
          supabase.from('data_izin').select('*').eq('id_karyawan', user.id_karyawan).order('created_at', { ascending: false }).limit(1),
          supabase.from('data_pengumuman').select('*').order('tanggal', { ascending: false }).limit(10),
        ]);

        if (!active) return;

        const lembur = resLembur.data || [];
        const totalLembur = lembur.reduce((acc, r) => acc + (parseFloat(r.durasi) || 0), 0);

        setSummary({
          totalLembur,
          jmlLembur: lembur.length,
          sisaIzin: 12, // placeholder kuota, sesuaikan dengan kebijakan HRD
          izinTerakhir: (resIzin.data && resIzin.data[0]) || null,
        });
        setPengumuman(resPengumuman.data || []);
      } catch {
        // ignore — tampilkan empty state
      } finally {
        if (active) setLoading(false);
      }
    }
    if (user) load();
    return () => { active = false; };
  }, [user]);

  const firstName = user?.nama_karyawan?.split(' ')[0] || 'Tim';
  const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const tanggalStr = `${HARI[now.getDay()]}, ${now.getDate()} ${NAMA_BULAN[now.getMonth()]} ${now.getFullYear()}`;
  const jamStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Halo, {firstName} 👋</h1>
        <p className="page-subtitle">
          {user?.jabatan || user?.departemen || 'Karyawan'}
        </p>
        <div className="header-meta">
          <span className="meta-chip">📅 {tanggalStr}</span>
          <span className="meta-chip">🕒 {jamStr}</span>
        </div>
      </div>

      {user?.pin === '123456' && (
        <div className="alert alert--warning">
          ⚠️ PIN kamu masih default (123456). Segera ubah lewat menu <strong>Profil</strong>.
        </div>
      )}

      <div className="bento-grid">
        <div className="bento-card">
          <div className="bento-icon">⏱️</div>
          <div className="bento-body">
            <div className="bento-label">Jam Lembur</div>
            <div className="bento-value">{formatJam(summary.totalLembur)}</div>
            <div className="bento-sub">{summary.jmlLembur} catatan bulan ini</div>
          </div>
        </div>
        <div className="bento-card">
          <div className="bento-icon">🏖️</div>
          <div className="bento-body">
            <div className="bento-label">Sisa Cuti</div>
            <div className="bento-value">{summary.sisaIzin} Hari</div>
            <div className="bento-sub">Estimasi kuota tahunan</div>
          </div>
        </div>
      </div>

      {summary.izinTerakhir && (
        <div className="card">
          <div className="card-head">
            <div className="card-head__icon">🕐</div>
            <div>
              <h3 className="card-head__title">Status Izin Terakhir</h3>
              <p className="card-head__desc">{summary.izinTerakhir.kategori_izin}</p>
            </div>
            <span className={`badge badge--${(summary.izinTerakhir.status || 'pending').toLowerCase()}`} style={{ marginLeft: 'auto' }}>
              {summary.izinTerakhir.status || 'PENDING'}
            </span>
          </div>

          <div className="timeline-meta">
            <span>📅 {summary.izinTerakhir.tanggal_izin_mulai}
              {summary.izinTerakhir.tanggal_izin_akhir && summary.izinTerakhir.tanggal_izin_akhir !== summary.izinTerakhir.tanggal_izin_mulai
                ? ` s/d ${summary.izinTerakhir.tanggal_izin_akhir}`
                : ''}
            </span>
          </div>

          {summary.izinTerakhir.alasan && (
            <div className="timeline-row__sub" style={{ marginTop: '8px' }}>{summary.izinTerakhir.alasan}</div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div className="card-head__icon">📢</div>
          <div>
            <h3 className="card-head__title">Papan Pengumuman</h3>
            <p className="card-head__desc">Informasi terbaru untuk kamu</p>
          </div>
        </div>
        {loading ? (
          <Loading lines={3} />
        ) : pengumuman.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon">📭</span>
            Belum ada pengumuman.
          </div>
        ) : (
          <div className="notice-list">
            {pengumuman.map((p) => (
              <div className="notice-item" key={p.id}>
                <div className="notice-title">{p.judul}</div>
                {p.isi_pesan && <div className="notice-body">{p.isi_pesan}</div>}
                <div className="notice-meta">
                  <span className="badge badge--accent">{p.label_kategori || 'Info'}</span>
                  <span>📅 {p.tanggal}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
