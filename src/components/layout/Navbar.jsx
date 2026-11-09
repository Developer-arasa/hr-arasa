import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { IconHome, IconDoc, IconClock, IconUser, IconLogout, IconBrand } from '../Icons';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: IconHome },
  { to: '/izin', label: 'Izin & Cuti', icon: IconDoc },
  { to: '/lembur', label: 'Lembur', icon: IconClock },
  { to: '/profil', label: 'Profil Saya', icon: IconUser },
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
          <div className="navbar-user-card">
            <div className="navbar-user-avatar">
              {(user.nama_karyawan || '?').charAt(0).toUpperCase()}
            </div>
            <div className="navbar-user-info">
              <div className="navbar-user-name">
                {user.nama_karyawan}
              </div>
              <div className="navbar-user-role">
                {user.jabatan || user.departemen || 'Karyawan'}
              </div>
            </div>
          </div>
        )}
        <button className="navbar-logout-btn" onClick={logout}>
          <IconLogout /> Keluar
        </button>
      </div>
    </nav>
  );
}
