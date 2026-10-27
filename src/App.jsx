import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore, isIncomplete } from './store/authStore';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Izin from './pages/Izin';
import Lembur from './pages/Lembur';
import Profil from './pages/Profil';
import Setup from './pages/Setup';

function ProtectedRoute({ children, allowIncomplete = false }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!allowIncomplete && isIncomplete(user)) return <Navigate to="/setup" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/setup"
        element={
          <ProtectedRoute allowIncomplete>
            <Setup />
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/izin" element={<Izin />} />
        <Route path="/lembur" element={<Lembur />} />
        <Route path="/profil" element={<Profil />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

