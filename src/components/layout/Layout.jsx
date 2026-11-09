import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import BottomNav from './BottomNav';

export default function Layout() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <div className="app-container">
        <Navbar />
        <main className="app-content">
          <div key={location.pathname} className="page-transition-wrapper">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
