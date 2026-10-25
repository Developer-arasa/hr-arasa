import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { z } from 'zod';
import { IconBrand, IconError } from '../components/Icons';

const loginSchema = z.object({
  id_karyawan: z.string().min(1, 'ID Karyawan wajib diisi'),
  pin: z.string().regex(/^\d{6}$/, 'PIN harus 6 digit angka'),
});

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);

  const [id, setId] = useState('');
  const [pin, setPin] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const parsed = loginSchema.safeParse({ id_karyawan: id.trim(), pin });
    if (!parsed.success) {
      const fieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0]] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    const result = await login(parsed.data.id_karyawan, parsed.data.pin);
    if (result.ok) {
      navigate('/dashboard', { replace: true });
    } else {
      setFormError(result.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark" style={{ width: 48, height: 48, borderRadius: 14 }}>
            <IconBrand style={{ width: 26, height: 26 }} />
          </div>
          <div>
            <h1 className="brand-name" style={{ fontSize: 28 }}>Arasa HR</h1>
            <p className="brand-sub">Employee Portal</p>
          </div>
        </div>

        <h2 className="auth-title">Masuk Karyawan</h2>
        <p className="auth-subtitle">Gunakan ID Karyawan dan PIN 6 digit untuk melanjutkan.</p>

        {formError && (
          <div className="alert alert--error"><IconError /> {formError}</div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="id">ID Karyawan</label>
            <input
              id="id"
              className={`form-input${errors.id_karyawan ? ' input-error' : ''}`}
              type="text"
              placeholder="Masukkan ID Karyawan"
              value={id}
              onChange={(e) => setId(e.target.value)}
              autoComplete="username"
            />
            {errors.id_karyawan && <div className="form-hint">{errors.id_karyawan}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="pin">PIN</label>
            <input
              id="pin"
              className={`form-input${errors.pin ? ' input-error' : ''}`}
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="6 digit angka"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              autoComplete="current-password"
            />
            {errors.pin && <div className="form-hint">{errors.pin}</div>}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? (
              <span className="btn-spinner">
                <span className="btn-spinner__dot" /> Memeriksa...
              </span>
            ) : (
              'Masuk'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

