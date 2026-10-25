import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import Loading from '../components/Loading';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { IconCal, IconClock, IconTrend, IconBell, IconCheck, IconWave } from '../components/Icons';

function formatJam(durasi) {
  const totalMenit = Math.round(parseFloat(durasi) * 60);
  if (!totalMenit || isNaN(totalMenit)) return '0 Menit';
  const j = Math.floor(totalMenit / 60);
  const m = totalMenit % 60;
  if (j > 0 && m > 0) return `${j} Jam ${m} Menit`;
  if (j > 0) return `${j} Jam`;
  return `${m} Menit`;
}

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const NAMA_BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function dayCount(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s) || isNaN(e)) return 0;
  return Math.max(1, Math.floor((e - s) / 86400000) + 1);
}

const PIE_COLORS = ['#c1121f', '#e7a0a5', '#f4c9cc', '#d96b73'];

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);

  const [summary, setSummary] = useState({ totalLembur: 0, jmlLembur: 0, sisaCuti: 0, jatahCuti: 12, izinTerakhir: null });
  const [pengumuman, setPengumuman] = useState([]);
  const [monthlyLembur, setMonthlyLembur] = useState([]);
  const [izinByKategori, setIzinByKategori] = useState([]);
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
        const today = new Date();
        const bulanStr = `${NAMA_BULAN[today.getMonth()]} ${today.getFullYear()}`;
        const tahun = today.getFullYear();

        const [resLembur, resIzin, resPengumuman, resMaster, resIzinAll, resLemburYear] = await Promise.all([
          supabase.from('data_lembur').select('*').eq('id_karyawan', user.id_karyawan).eq('bulan_lembur', bulanStr),
          supabase.from('data_izin').select('*').eq('id_karyawan', user.id_karyawan).order('created_at', { ascending: false }).limit(1),
          supabase.from('data_pengumuman').select('*').order('tanggal', { ascending: false }).limit(10),
          supabase.from('master_data').select('jatah_cuti').eq('id_karyawan', user.id_karyawan).maybeSingle(),
          supabase.from('data_izin').select('*').eq('id_karyawan', user.id_karyawan),
          supabase.from('data_lembur').select('*').eq('id_karyawan', user.id_karyawan),
        ]);

        if (!active) return;

        const isApproved = (s) => ['DISETUJUI', 'IZIN_DIBERIKAN', 'IZIN DIBERIKAN'].includes((s || '').trim().toUpperCase());

        const lembur = (resLembur.data || []).filter((r) => isApproved(r.status));
        const totalLembur = lembur.reduce((acc, r) => acc + (parseFloat(r.durasi) || 0), 0);

        // Sisa cuti = jatah_cuti - total hari izin disetujui (semua kategori)
        const jatahCuti = resMaster.data?.jatah_cuti ?? 12;
        const approvedIzin = (resIzinAll.data || []).filter((r) => isApproved(r.status));
        const usedDays = approvedIzin.reduce((acc, r) => acc + dayCount(r.tanggal_izin_mulai, r.tanggal_izin_akhir), 0);
        const sisaCuti = Math.max(0, jatahCuti - usedDays);

        const lemburYear = (resLemburYear.data || []).filter((r) => isApproved(r.status));
        const monthly = NAMA_BULAN_SINGKAT.map((m, i) => {
          const total = lemburYear.reduce((acc, r) => {
            if ((r.bulan_lembur || '').includes(NAMA_BULAN[i]) && (r.bulan_lembur || '').includes(String(tahun))) {
              return acc + (parseFloat(r.durasi) || 0);
            }
            return acc;
          }, 0);
          return { bulan: m, jam: Math.round(total * 10) / 10 };
        });

        const catCount = {};
        approvedIzin.forEach((r) => {
          const k = r.kategori_izin || 'Lainnya';
          catCount[k] = (catCount[k] || 0) + 1;
        });
        const izinByCat = Object.entries(catCount).map(([name, value]) => ({ name, value }));

        setSummary({ totalLembur, jmlLembur: lembur.length, sisaCuti, jatahCuti, izinTerakhir: (resIzin.data && resIzin.data[0]) || null });
        setMonthlyLembur(monthly);
        setIzinByKategori(izinByCat);
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
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const tanggalStr = `${HARI[now.getDay()]}, ${now.getDate()} ${NAMA_BULAN[now.getMonth()]} ${now.getFullYear()}`;
  const jamStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const sisaPct = summary.jatahCuti > 0 ? Math.round((summary.sisaCuti / summary.jatahCuti) * 100) : 0;
  const donutData = [
    { name: 'Sisa', value: summary.sisaCuti },
    { name: 'Terpakai', value: Math.max(0, summary.jatahCuti - summary.sisaCuti) },
  ];

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1 className="page-title">Halo, {firstName} <IconWave /></h1>
        <p className="page-subtitle">{user?.jabatan || user?.departemen || 'Karyawan'} · Selamat datang kembali</p>
        <div className="header-meta">
          <span className="meta-chip"><IconCal style={{ width: 13, height: 13 }} /> {tanggalStr}</span>
          <span className="meta-chip"><IconClock style={{ width: 13, height: 13 }} /> {jamStr}</span>
        </div>
      </div>

      {user?.pin === '123456' && (
        <div className="alert alert--error">
          PIN kamu masih default (123456). Segera ubah lewat menu <strong>Profil</strong>.
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card stat-card--accent">
          <div className="stat-icon"><IconTrend /></div>
          <div className="stat-label">Sisa Cuti</div>
          <div className="stat-value">{summary.sisaCuti}<span style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}> hari</span></div>
          <div className="stat-sub">dari kuota {summary.jatahCuti} hari</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><IconClock /></div>
          <div className="stat-label">Jam Lembur (Bulan Ini)</div>
          <div className="stat-value">{formatJam(summary.totalLembur)}</div>
          <div className="stat-sub">{summary.jmlLembur} catatan disetujui</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><IconCheck /></div>
          <div className="stat-label">Status Izin Terakhir</div>
          <div className="stat-value" style={{ fontSize: 'var(--font-size-lg)' }}>
            {summary.izinTerakhir ? summary.izinTerakhir.status : '—'}
          </div>
          <div className="stat-sub">{summary.izinTerakhir?.kategori_izin || 'Belum ada pengajuan'}</div>
        </div>
      </div>

      <div className="bento-grid section-gap">
        <div className="bento-card bento-card--span-6">
          <div className="bento-header">
            <div>
              <div className="bento-label">Cuti Tahunan</div>
              <h3 className="bento-title">Kuota vs Terpakai</h3>
            </div>
            <span className="badge badge--approved">{sisaPct}% tersisa</span>
          </div>
          <div style={{ height: 220, display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
            <div style={{ width: 140, height: 140, position: 'relative', flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius={46} outerRadius={64} paddingAngle={3} strokeWidth={0}>
                    <Cell fill="#c1121f" />
                    <Cell fill="#f0ddd9" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-1px' }}>{summary.sisaCuti}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 500 }}>hari</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <div className="bento-sub">Sisa</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--text-heading)' }}>{summary.sisaCuti} hari</div>
              </div>
              <div>
                <div className="bento-sub">Terpakai</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--text-dark)' }}>{Math.max(0, summary.jatahCuti - summary.sisaCuti)} hari</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bento-card bento-card--span-6">
          <div className="bento-header">
            <div>
              <div className="bento-label">Aktivitas</div>
              <h3 className="bento-title">Jam Lembur per Bulan</h3>
            </div>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyLembur} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="lemburFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c1121f" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#c1121f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eae6df" vertical={false} />
                <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: '#a29c94' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#a29c94' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #eae6df', fontSize: 12 }} />
                <Area type="monotone" dataKey="jam" stroke="#c1121f" strokeWidth={2.5} fill="url(#lemburFill)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bento-grid section-gap">
        <div className="bento-card bento-card--span-6">
          <div className="bento-header">
            <div>
              <div className="bento-label">Distribusi</div>
              <h3 className="bento-title">Izin per Kategori</h3>
            </div>
          </div>
          {izinByKategori.length === 0 ? (
            <div className="empty-state"><p>Belum ada izin disetujui.</p></div>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={izinByKategori} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eae6df" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#a29c94' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#a29c94' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #eae6df', fontSize: 12 }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={48}>
                    {izinByKategori.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bento-card bento-card--span-6">
          <div className="bento-header">
            <div>
              <div className="bento-label">Terbaru</div>
              <h3 className="bento-title">Status Izin Terakhir</h3>
            </div>
            {summary.izinTerakhir && (
              <span className={`badge badge--${(summary.izinTerakhir.status || 'pending').toLowerCase()}`}>
                {summary.izinTerakhir.status || 'PENDING'}
              </span>
            )}
          </div>
          {!summary.izinTerakhir ? (
            <div className="empty-state"><p>Belum ada pengajuan izin.</p></div>
          ) : (
            <div>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--text-heading)' }}>
                {summary.izinTerakhir.kategori_izin}
              </div>
              <div className="bento-sub" style={{ marginTop: 4 }}>
                {summary.izinTerakhir.tanggal_izin_mulai}
                {summary.izinTerakhir.tanggal_izin_akhir && summary.izinTerakhir.tanggal_izin_akhir !== summary.izinTerakhir.tanggal_izin_mulai
                  ? ` s/d ${summary.izinTerakhir.tanggal_izin_akhir}` : ''}
              </div>
              {summary.izinTerakhir.alasan && (
                <div className="bento-sub" style={{ marginTop: 12, color: 'var(--text-muted)' }}>
                  "{summary.izinTerakhir.alasan}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card section-gap">
        <div className="bento-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="stat-icon" style={{ margin: 0 }}><IconBell /></div>
            <div>
              <h3 className="bento-title">Papan Pengumuman</h3>
              <div className="bento-sub">Informasi terbaru untuk kamu</div>
            </div>
          </div>
        </div>
        {loading ? (
          <Loading lines={3} />
        ) : pengumuman.length === 0 ? (
          <div className="empty-state"><p>Belum ada pengumuman.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {pengumuman.map((p) => (
              <div key={p.id} style={{ padding: 'var(--space-4)', background: 'var(--surface-soft)', borderRadius: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--text-heading)' }}>{p.judul}</div>
                  <span className="badge badge--neutral">{p.label_kategori || 'Info'}</span>
                </div>
                {p.isi_pesan && <div className="bento-sub" style={{ marginTop: 6, color: 'var(--text-muted)' }}>{p.isi_pesan}</div>}
                <div className="bento-sub" style={{ marginTop: 8 }}><IconCal style={{ width: 12, height: 12, verticalAlign: '-2px' }} /> {p.tanggal}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
