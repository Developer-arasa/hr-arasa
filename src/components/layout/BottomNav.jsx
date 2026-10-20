import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/izin', label: 'Izin', icon: '📄' },
  { to: '/lembur', label: 'Lembur', icon: '⏱️' },
  { to: '/profil', label: 'Profil', icon: '👤' },
];

export default function BottomNav() {
  return (
    <nav className="app-bottom-nav">
      <div className="bottom-links">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-link nav-link--bottom${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
