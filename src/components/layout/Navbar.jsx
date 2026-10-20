import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/izin', label: 'Izin', icon: '📄' },
  { to: '/lembur', label: 'Lembur', icon: '⏱️' },
  { to: '/profil', label: 'Profil', icon: '👤' },
];

export default function Navbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <nav className="app-navbar">
      <div className="navbar-brand">
        <h1 className="brand-name">HR ARASA</h1>
        <p className="brand-sub">Portal Sistem Informasi Pegawai</p>
      </div>

      <div className="navbar-links">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="navbar-footer">
        {user && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Login sebagai: <strong style={{ color: 'var(--text-dark)' }}>{user.nama_karyawan}</strong>
          </div>
        )}
        <button className="nav-link" onClick={logout}>
          <span className="nav-icon">🚪</span> Keluar
        </button>
      </div>
    </nav>
  );
}
