import { NavLink } from 'react-router-dom';
import { IconHome, IconDoc, IconClock, IconUser } from '../Icons';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Home', icon: IconHome },
  { to: '/izin', label: 'Izin', icon: IconDoc },
  { to: '/lembur', label: 'Lembur', icon: IconClock },
  { to: '/profil', label: 'Profil', icon: IconUser },
];

export default function BottomNav() {
  return (
    <nav className="app-bottom-nav">
      <div className="bottom-links">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `bottom-link${isActive ? ' active' : ''}`}
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

