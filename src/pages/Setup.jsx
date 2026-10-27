import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, isIncomplete } from '../store/authStore';
import { IconBrand, IconDoor } from '../components/Icons';
import { z } from 'zod';

const biodataSchema = z.object({
  tempat_lahir: z.string().trim().min(1, 'Tempat lahir wajib diisi'),
  tgl_lahir: z.string().min(1, 'Tanggal lahir wajib diisi'),
  no_hp: z.string().trim().min(1, 'No. HP wajib diisi'),
  alamat_domisili: z.string().trim().min(1, 'Alamat domisili wajib diisi'),
  status_nikah: z.string().min(1, 'Pilih status nikah'),
  kontak_darurat: z.string().trim().min(1, 'Kontak darurat wajib diisi'),
});

const pinSchema = z
  .object({
    pin_baru: z.string().regex(/^\d{6}$/, 'PIN baru harus 6 digit angka'),
    pin_konfirmasi: z.string().regex(/^\d{6}$/, 'Konfirmasi PIN harus 6 digit angka'),
  })
  .refine((d) => d.pin_baru === d.pin_konfirmasi, {
    message: 'Konfirmasi PIN tidak cocok',
    path: ['pin_konfirmasi'],
  })
  .refine((d) => d.pin_baru !== '123456', {
    message: 'PIN baru tidak boleh sama dengan PIN bawaan (123456)',
    path: ['pin_baru'],
  });

export default function Setup() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const completeSetup = useAuthStore((s) => s.completeSetup);
  const logout = useAuthStore((s) => s.logout);

  const [form, setForm] = useState({
    tempat_lahir: user?.tempat_lahir || '',
    tgl_lahir: user?.tgl_lahir || '',
    no_hp: user?.no_hp || '',
    alamat_domisili: user?.alamat_domisili || '',
    status_nikah: user?.status_nikah || '',
    kontak_darurat: user?.kontak_darurat || '',
    pin_baru: '',
    pin_konfirmasi: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Jika user sudah lengkap (mis. sudah selesai setup), jangan biarkan
  // mengakses halaman ini — kembalikan ke dashboard.
  useEffect(() => {
    if (user && !isIncomplete(user)) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  function handleField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setFormError('');

    const biodata = biodataSchema.safeParse({
      tempat_lahir: form.tempat_lahir,
      tgl_lahir: form.tgl_lahir,
      no_hp: form.no_hp,
      alamat_domisili: form.alamat_domisili,
      status_nikah: form.status_nikah,
      kontak_darurat: form.kontak_darurat,
    });
    const pin = pinSchema.safeParse({
      pin_baru: form.pin_baru,
      pin_konfirmasi: form.pin_konfirmasi,
    });

    const fieldErrors = {};
    if (!biodata.success) {
      biodata.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0]] = issue.message;
      });
    }
    if (!pin.success) {
      pin.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0]] = issue.message;
      });
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    const result = await completeSetup({
      ...biodata.data,
      pin: pin.data.pin_baru,
    });
    setSaving(false);

    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    navigate('/dashboard', { replace: true });
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const needPin = user?.pin === '123456';

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

        <h2 className="auth-title">Lengkapi Data Kamu</h2>
        <p className="auth-subtitle">
          Halo, {user?.nama_karyawan || 'Karyawan'}. Sebelum lanjut, lengkapi biodata
          {needPin ? ' dan ganti PIN bawaan kamu' : ''} di bawah ini.
        </p>

        {formError && (
          <div className="alert alert--error">{formError}</div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="tempat_lahir">Tempat Lahir</label>
            <input
              id="tempat_lahir"
              className={`form-input${errors.tempat_lahir ? ' input-error' : ''}`}
              type="text"
              placeholder="Contoh: Jakarta"
              value={form.tempat_lahir}
              onChange={(e) => handleField('tempat_lahir', e.target.value)}
            />
            {errors.tempat_lahir && <div className="form-hint">{errors.tempat_lahir}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="tgl_lahir">Tanggal Lahir</label>
              <input
                id="tgl_lahir"
                className={`form-input${errors.tgl_lahir ? ' input-error' : ''}`}
                type="date"
                value={form.tgl_lahir}
                onChange={(e) => handleField('tgl_lahir', e.target.value)}
              />
              {errors.tgl_lahir && <div className="form-hint">{errors.tgl_lahir}</div>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="status_nikah">Status Nikah</label>
              <select
                id="status_nikah"
                className={`form-select${errors.status_nikah ? ' input-error' : ''}`}
                value={form.status_nikah}
                onChange={(e) => handleField('status_nikah', e.target.value)}
              >
                <option value="">Pilih status</option>
                <option value="Belum Menikah">Belum Menikah</option>
                <option value="Menikah">Menikah</option>
                <option value="Cerai Hidup">Cerai Hidup</option>
                <option value="Cerai Mati">Cerai Mati</option>
              </select>
              {errors.status_nikah && <div className="form-hint">{errors.status_nikah}</div>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="no_hp">No. HP</label>
            <input
              id="no_hp"
              className={`form-input${errors.no_hp ? ' input-error' : ''}`}
              type="tel"
              placeholder="Contoh: 081234567890"
              value={form.no_hp}
              onChange={(e) => handleField('no_hp', e.target.value)}
            />
            {errors.no_hp && <div className="form-hint">{errors.no_hp}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="alamat_domisili">Alamat Domisili</label>
            <textarea
              id="alamat_domisili"
              className={`form-textarea${errors.alamat_domisili ? ' input-error' : ''}`}
              rows={3}
              placeholder="Alamat tempat tinggal saat ini"
              value={form.alamat_domisili}
              onChange={(e) => handleField('alamat_domisili', e.target.value)}
            />
            {errors.alamat_domisili && <div className="form-hint">{errors.alamat_domisili}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="kontak_darurat">Kontak Darurat</label>
            <input
              id="kontak_darurat"
              className={`form-input${errors.kontak_darurat ? ' input-error' : ''}`}
              type="text"
              placeholder="Contoh: Budi (Ayah) — 081234567890"
              value={form.kontak_darurat}
              onChange={(e) => handleField('kontak_darurat', e.target.value)}
            />
            {errors.kontak_darurat && <div className="form-hint">{errors.kontak_darurat}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="pin_baru">PIN Baru</label>
              <input
                id="pin_baru"
                className={`form-input${errors.pin_baru ? ' input-error' : ''}`}
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="6 digit angka"
                value={form.pin_baru}
                onChange={(e) => handleField('pin_baru', e.target.value.replace(/\D/g, ''))}
                autoComplete="new-password"
              />
              {errors.pin_baru && <div className="form-hint">{errors.pin_baru}</div>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pin_konfirmasi">Konfirmasi PIN Baru</label>
              <input
                id="pin_konfirmasi"
                className={`form-input${errors.pin_konfirmasi ? ' input-error' : ''}`}
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="6 digit angka"
                value={form.pin_konfirmasi}
                onChange={(e) => handleField('pin_konfirmasi', e.target.value.replace(/\D/g, ''))}
                autoComplete="new-password"
              />
              {errors.pin_konfirmasi && <div className="form-hint">{errors.pin_konfirmasi}</div>}
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan & Lanjutkan'}
          </button>
        </form>

        <button className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={handleLogout}>
          <IconDoor /> Keluar / Log Out
        </button>
      </div>
    </div>
  );
}
