import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import Loading from '../components/Loading';
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  IconCal, IconClock, IconBell,
  IconDoc, IconChevronRight,
  IconCalendarCheck, IconActivity
} from '../components/Icons';

function formatJam(durasi) {
  const totalMenit = Math.round(parseFloat(durasi) * 60);
  if (!totalMenit || isNaN(totalMenit)) return '0 Jam';
  const j = Math.floor(totalMenit / 60);
  const m = totalMenit % 60;
  if (j > 0 && m > 0) return `${j}j ${m}m`;
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

// Tooltip modern untuk grafik
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#0f172a',
        color: '#ffffff',
        padding: '8px 12px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ color: '#94a3b8', fontSize: 10 }}>Bulan {label}</div>
        <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: 13, marginTop: 2 }}>
          {payload[0].value} Jam Lembur
        </div>
      </div>
    );
  }
  return null;
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);

  const [summary, setSummary] = useState({
    totalLembur: 0,
    jmlLembur: 0,
    sisaCuti: 0,
    jatahCuti: 12,
    usedDays: 0,
    izinTerakhir: null
  });
  const [pengumuman, setPengumuman] = useState([]);
  const [monthlyLembur, setMonthlyLembur] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const today = new Date();
        const bulanStr = `${NAMA_BULAN[today.getMonth()]} ${today.getFullYear()}`;
        const tahun = today.getFullYear();

        const [resLemburBulan, resIzinAll, resPengumuman, resMaster, resLemburYear] = await Promise.all([
          supabase.from('data_lembur').select('*').eq('id_karyawan', user.id_karyawan).eq('bulan_lembur', bulanStr),
          supabase.from('data_izin').select('*').eq('id_karyawan', user.id_karyawan).order('created_at', { ascending: false }),
          supabase.from('data_pengumuman').select('*').order('tanggal', { ascending: false }).limit(4),
          supabase.from('master_data').select('jatah_cuti').eq('id_karyawan', user.id_karyawan).maybeSingle(),
          supabase.from('data_lembur').select('*').eq('id_karyawan', user.id_karyawan).order('created_at', { ascending: false }),
        ]);

        if (!active) return;

        const isApproved = (s) => ['DISETUJUI', 'IZIN_DIBERIKAN', 'IZIN DIBERIKAN'].includes((s || '').trim().toUpperCase());

        const lemburBulan = (resLemburBulan.data || []).filter((r) => isApproved(r.status));
        const totalLembur = lemburBulan.reduce((acc, r) => acc + (parseFloat(r.durasi) || 0), 0);

        // Perhitungan Cuti
        const jatahCuti = resMaster.data?.jatah_cuti ?? 12;
        const allIzin = resIzinAll.data || [];
        const approvedIzin = allIzin.filter((r) => isApproved(r.status));
        const usedDays = approvedIzin.reduce((acc, r) => acc + dayCount(r.tanggal_izin_mulai, r.tanggal_izin_akhir), 0);
        const sisaCuti = Math.max(0, jatahCuti - usedDays);

        // Tren Bulanan
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

        // Gabungkan Aktivitas Terkini (Recent Activity)
        const combined = [
          ...allIzin.map((i) => ({
            id: `iz-${i.id}`,
            type: 'izin',
            title: `Pengajuan ${i.kategori_izin || 'Izin'}`,
            date: i.tanggal_izin_mulai === i.tanggal_izin_akhir ? i.tanggal_izin_mulai : `${i.tanggal_izin_mulai} s/d ${i.tanggal_izin_akhir}`,
            detail: i.alasan || 'Pengajuan izin karyawan',
            status: (i.status || 'PENDING').toUpperCase(),
            createdAt: i.created_at || i.tanggal_izin_mulai,
          })),
          ...(resLemburYear.data || []).map((l) => ({
            id: `lb-${l.id}`,
            type: 'lembur',
            title: `Lembur (${l.durasi || 0} Jam)`,
            date: l.tanggal_lembur,
            detail: l.alasan || 'Pekerjaan lembur di luar jam kantor',
            status: (l.status || 'PENDING').toUpperCase(),
            createdAt: l.created_at || l.tanggal_lembur,
          })),
        ]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 4);

        setSummary({
          totalLembur,
          jmlLembur: lemburBulan.length,
          sisaCuti,
          jatahCuti,
          usedDays,
          izinTerakhir: allIzin[0] || null,
        });
        setMonthlyLembur(monthly);
        setRecentActivities(combined);
        setPengumuman(resPengumuman.data || []);
      } catch {
        // Abaikan error jaringan jika ada
      } finally {
        if (active) setLoading(false);
      }
    }

    if (user) load();
    return () => { active = false; };
  }, [user]);

  const firstName = user?.nama_karyawan?.split(' ')[0] || 'Karyawan';

  // Perhitungan SVG Donut Ring
  const sisaPct = summary.jatahCuti > 0 ? Math.round((summary.sisaCuti / summary.jatahCuti) * 100) : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * Math.min(100, Math.max(0, sisaPct))) / 100;

  if (loading) {
    return (
      <div key="loading" className="page-enter" style={{ padding: '40px 0' }}>
        <Loading lines={4} />
      </div>
    );
  }

  return (
    <div key="content" className="page-enter subtab-spring-enter" style={{ paddingBottom: 40 }}>
      {/* ===== 1. GRADIENT HEADER (TOP OF SCREEN) ===== */}
      <div className="layered-header">
        {/* Top bar: Status pill on left, Bell & Avatar on right */}
        <div className="layered-top-bar">
          <div className="header-status-pill">
            <span>Arasa HR • {user?.departemen || user?.jabatan || 'Team Member'}</span>
            <span style={{ opacity: 0.6 }}>▾</span>
          </div>

          <div className="header-user-actions">
            <div className="header-icon-btn">
              <IconBell style={{ width: 18, height: 18 }} />
              <div className="header-icon-dot" />
            </div>
            <div className="header-avatar-circle">
              {firstName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Greeting */}
        <div className="layered-greeting">
          <h1 className="layered-greeting-title">
            Halo, {firstName} 👋
          </h1>
          <p className="layered-greeting-sub">
            Berikut ringkasan performa & hak cuti Anda
          </p>
        </div>

        {/* Balance / Quick Action Bar */}
        <div className="layered-balance-bar">
          <div className="balance-info-left">
            <div className="balance-icon-box">
              <IconCalendarCheck style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <div className="balance-label">Sisa Cuti Tahunan</div>
              <div className="balance-val">{summary.sisaCuti} Hari Tersisa</div>
            </div>
          </div>

          <Link to="/izin" className="balance-action-btn">
            + Ajukan Cuti
          </Link>
        </div>
      </div>

      {/* ===== 2. OVERLAPPING WHITE CARD ("NUMPUK" ATAS GRADIENT) ===== */}
      <div className="overlap-main-card">
        {/* Top Tags */}
        <div className="overlap-card-tags">
          <span className="tag-pill-green">In Use</span>
          <span className="tag-pill-blue">Cuti Tahunan</span>
        </div>

        {/* Main Content Body */}
        <div className="overlap-card-body">
          <div className="overlap-info-left">
            <div className="overlap-info-header">
              <div className="squircle-badge-green">
                <IconCalendarCheck style={{ width: 22, height: 22 }} />
              </div>
              <div>
                <div className="overlap-card-title">Cuti Tahunan</div>
                <div className="overlap-card-sub">Periode {new Date().getFullYear()}</div>
              </div>
            </div>

            <div className="overlap-details-bottom">
              <div>Terpakai: <strong>{summary.usedDays}</strong> dari <strong>{summary.jatahCuti}</strong> hari</div>
              <div style={{ marginTop: 2, fontSize: 11, color: '#94a3b8' }}>
                Berlaku s/d 31 Des {new Date().getFullYear()}
              </div>
            </div>
          </div>

          {/* Circular Donut Ring (3.5 GB / 5 GB style in reference) */}
          <div className="overlap-donut-right">
            <svg width="104" height="104" viewBox="0 0 104 104" style={{ transform: 'rotate(-90deg)' }}>
              <defs>
                <linearGradient id="donutRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              <circle
                cx="52"
                cy="52"
                r={radius}
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="9"
              />
              <circle
                cx="52"
                cy="52"
                r={radius}
                fill="none"
                stroke="url(#donutRingGrad)"
                strokeWidth="9"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
            </svg>
            <div className="overlap-donut-center">
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                {summary.sisaCuti}
              </div>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginTop: 2 }}>
                /{summary.jatahCuti} Hari
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 3. POPULAR PLAN / LAYANAN MANDIRI (2-COLUMN CARDS) ===== */}
      <div style={{ marginBottom: 24 }}>
        <div className="popular-section-header">
          <h2 className="popular-section-title">Layanan Mandiri</h2>
          <Link to="/lembur" className="popular-section-link">Lihat Semua</Link>
        </div>

        <div className="popular-grid-2">
          {/* Card 1: Form Lembur */}
          <Link to="/lembur" className="popular-plan-card">
            <div className="plan-card-top">
              <div className="squircle-badge-green" style={{ background: '#ecfdf5', color: '#059669', width: 38, height: 38, borderRadius: 12 }}>
                <IconClock style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <div className="plan-card-name">Catat Lembur</div>
                <div className="plan-card-category">Harian & Proyek</div>
              </div>
            </div>
            <div className="plan-card-metric">
              Total Bulan Ini
            </div>
            <div className="plan-card-bottom">
              <div className="plan-card-val">
                {formatJam(summary.totalLembur)}
              </div>
              <IconChevronRight style={{ width: 16, height: 16, color: '#94a3b8' }} />
            </div>
          </Link>

          {/* Card 2: Pengajuan Izin */}
          <Link to="/izin" className="popular-plan-card">
            <div className="plan-card-top">
              <div className="squircle-badge-green" style={{ background: '#ecfdf5', color: '#059669', width: 38, height: 38, borderRadius: 12 }}>
                <IconDoc style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <div className="plan-card-name">Pengajuan Izin</div>
                <div className="plan-card-category">Sakit & Keperluan</div>
              </div>
            </div>
            <div className="plan-card-metric">
              Status Terakhir
            </div>
            <div className="plan-card-bottom">
              <div className="plan-card-val" style={{ fontSize: 13, color: summary.izinTerakhir?.status === 'DISETUJUI' ? '#059669' : '#d97706' }}>
                {summary.izinTerakhir ? (summary.izinTerakhir.status === 'IZIN_DIBERIKAN' ? 'DISETUJUI' : summary.izinTerakhir.status) : 'Belum Ada'}
              </div>
              <IconChevronRight style={{ width: 16, height: 16, color: '#94a3b8' }} />
            </div>
          </Link>
        </div>
      </div>

      {/* ===== 4. USAGE HISTORY (AREA CHART) & RECENT ACTIVITY ===== */}
      <div className="dash-grid-split">
        {/* Left: Usage History Chart */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Statistik Kerja
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0' }}>
                Tren Jam Lembur
              </h3>
            </div>
            <span className="badge-pill badge-pill--neutral" style={{ fontSize: 10, padding: '3px 8px' }}>
              <IconActivity style={{ width: 12, height: 12 }} /> Tahun Ini
            </span>
          </div>

          <div style={{ height: 200, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyLembur} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="70%" stopColor="#06b6d4" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="bulan"
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  unit="j"
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="jam"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#usageGradient)"
                  dot={{ r: 3, fill: '#2563eb', strokeWidth: 1.5, stroke: '#ffffff' }}
                  activeDot={{ r: 5, fill: '#06b6d4', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Recent Activity (List Style like in Image) */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              Aktivitas Terkini
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Terbaru</span>
          </div>

          {recentActivities.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 16px' }}>
              <p>Belum ada aktivitas pengajuan.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentActivities.map((item) => (
                <div key={item.id} className="activity-card" style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div className="squircle-badge-green" style={{ width: 34, height: 34, borderRadius: 10 }}>
                      {item.type === 'izin' ? <IconDoc style={{ width: 16, height: 16 }} /> : <IconClock style={{ width: 16, height: 16 }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                        {item.date}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span className={`badge-pill badge-pill--${item.status === 'DISETUJUI' || item.status === 'IZIN_DIBERIKAN' ? 'approved' : item.status === 'DITOLAK' ? 'rejected' : 'pending'}`} style={{ fontSize: 10, padding: '3px 8px' }}>
                      {item.status === 'IZIN_DIBERIKAN' ? 'DISETUJUI' : item.status}
                    </span>
                    <IconChevronRight style={{ width: 14, height: 14, color: '#cbd5e1' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== 5. PAPAN PENGUMUMAN (FEED STYLE) ===== */}
      {pengumuman.length > 0 && (
        <div className="card" style={{ padding: 20, marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              Papan Pengumuman
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Edaran Resmi</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {pengumuman.map((p) => (
              <div key={p.id} className="announcement-item-fresh">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>
                    {p.judul}
                  </div>
                  <span className="badge-pill badge-pill--neutral" style={{ fontSize: 9, padding: '2px 6px' }}>
                    {p.label_kategori || 'Info'}
                  </span>
                </div>
                {p.isi_pesan && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {p.isi_pesan}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-faint)', marginTop: 6 }}>
                  <IconCal style={{ width: 11, height: 11 }} />
                  <span>{p.tanggal}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
