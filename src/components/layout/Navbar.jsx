import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { IconHome, IconDoc, IconClock, IconUser, IconLogout, IconBrand } from '../Icons';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: IconHome },
  { to: '/izin', label: 'Izin', icon: IconDoc },
  { to: '/lembur', label: 'Lembur', icon: IconClock },
  { to: '/profil', label: 'Profil', icon: IconUser },
];

export default function Navbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <nav className="app-navbar">
      <div className="navbar-brand">
        <div className="brand-mark">
          <IconBrand />
        </div>
        <div>
          <h1 className="brand-name">Arasa HR</h1>
          <p className="brand-sub">Employee Portal</p>
        </div>
      </div>

      <div className="navbar-links">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </div>

      <div className="navbar-footer">
        {user && (
          <div className="navbar-user" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px 12px' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'var(--accent-soft)',
                color: 'var(--accent-2)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {(user.nama_karyawan || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.nama_karyawan}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {user.jabatan || user.id_karyawan || 'Karyawan'}
              </div>
            </div>
          </div>
        )}
        <button className="nav-link" onClick={logout} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}>
          <IconLogout /> Keluar
        </button>
      </div>
    </nav>
  );
}

