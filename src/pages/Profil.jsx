import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import { IconCog, IconFolder, IconPen, IconLock, IconDoor } from '../components/Icons';
import { z } from 'zod';

const bukuIndukSchema = z.object({
  tempat_lahir: z.string().trim().min(1, 'Tempat lahir wajib diisi'),
  tgl_lahir: z.string().min(1, 'Tanggal lahir wajib diisi'),
  no_hp: z.string().trim().min(1, 'No. HP wajib diisi'),
  alamat_domisili: z.string().trim().min(1, 'Alamat domisili wajib diisi'),
  status_nikah: z.string().min(1, 'Pilih status nikah'),
  kontak_darurat: z.string().trim().min(1, 'Kontak darurat wajib diisi'),
});

const pinSchema = z
  .object({
    pin_lama: z.string().regex(/^\d{6}$/, 'PIN lama harus 6 digit angka'),
    pin_baru: z.string().regex(/^\d{6}$/, 'PIN baru harus 6 digit angka'),
    pin_konfirmasi: z.string().regex(/^\d{6}$/, 'Konfirmasi PIN harus 6 digit angka'),
  })
  .refine((d) => d.pin_baru === d.pin_konfirmasi, {
    message: 'Konfirmasi PIN tidak cocok',
    path: ['pin_konfirmasi'],
  })
  .refine((d) => d.pin_baru !== d.pin_lama, {
    message: 'PIN baru tidak boleh sama dengan PIN lama',
    path: ['pin_baru'],
  });

export default function Profil() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const logout = useAuthStore((s) => s.logout);
  const initial = (user?.nama_karyawan || '?').trim().charAt(0).toUpperCase();

  // === Buku induk state ===
  const [form, setForm] = useState({
    tempat_lahir: user?.tempat_lahir || '',
    tgl_lahir: user?.tgl_lahir || '',
    no_hp: user?.no_hp || '',
    alamat_domisili: user?.alamat_domisili || '',
    status_nikah: user?.status_nikah || '',
    kontak_darurat: user?.kontak_darurat || '',
  });
  const [errors, setErrors] = useState({});
  const [savingBuku, setSavingBuku] = useState(false);

  // === Ganti PIN state ===
  const [pin, setPin] = useState({ pin_lama: '', pin_baru: '', pin_konfirmasi: '' });
  const [pinErrors, setPinErrors] = useState({});
  const [savingPin, setSavingPin] = useState(false);

  // === Modal ===
  const [modal, setModal] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('data');

  function closeModal() {
    setModal(null);
  }

  function handleField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handlePin(key, value) {
    setPin((prev) => ({ ...prev, [key]: value }));
  }

  async function saveBukuInduk(e) {
    e.preventDefault();
    setErrors({});

    const parsed = bukuIndukSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0]] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSavingBuku(true);
    const { error } = await supabase
      .from('master_data')
      .update(parsed.data)
      .eq('id_karyawan', user.id_karyawan);

    setSavingBuku(false);

    if (error) {
      setModal({ type: 'alert', icon: 'error', title: 'Gagal Menyimpan', msg: 'Gagal terhubung ke server. Silakan coba lagi nanti.' });
      return;
    }

    await refreshUser();
    setModal({ type: 'alert', icon: 'success', title: 'Berhasil', msg: 'Data buku induk berhasil diperbarui.' });
  }

  async function savePin(e) {
    e.preventDefault();
    setPinErrors({});

    const parsed = pinSchema.safeParse(pin);
    if (!parsed.success) {
      const fieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0]] = issue.message;
      });
      setPinErrors(fieldErrors);
      return;
    }

    // Verifikasi PIN lama
    setSavingPin(true);
    const { data: check, error: checkErr } = await supabase
      .from('master_data')
      .select('id_karyawan')
      .eq('id_karyawan', user.id_karyawan)
      .eq('pin', parsed.data.pin_lama)
      .maybeSingle();

    if (checkErr) {
      setSavingPin(false);
      setModal({ type: 'alert', icon: 'error', title: 'Gagal', msg: 'Gagal terhubung ke server. Silakan coba lagi nanti.' });
      return;
    }

    if (!check) {
      setSavingPin(false);
      setPinErrors({ pin_lama: 'PIN lama salah' });
      return;
    }

    const { error } = await supabase
      .from('master_data')
      .update({ pin: parsed.data.pin_baru })
      .eq('id_karyawan', user.id_karyawan);

    setSavingPin(false);

    if (error) {
      setModal({ type: 'alert', icon: 'error', title: 'Gagal', msg: 'Gagal terhubung ke server. Silakan coba lagi nanti.' });
      return;
    }

    setPin({ pin_lama: '', pin_baru: '', pin_konfirmasi: '' });
    setModal({ type: 'alert', icon: 'success', title: 'Berhasil', msg: 'PIN berhasil diganti.' });
  }

  function handleLogout() {
    setModal({
      type: 'confirm',
      icon: 'door',
      title: 'Keluar dari akun?',
      msg: 'Sesi login kamu akan dihapus dari perangkat ini.',
    });
  }

  function doLogout() {
    setModal(null);
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profil</h1>
          <p className="page-subtitle">Lihat identitas kamu & kelola pengaturan akun.</p>
        </div>
        <button className="btn btn-ghost" onClick={() => setSettingsOpen(true)}>
          <IconCog /> Settings
        </button>
      </div>

      {/* ===== Kartu Identitas Digital ===== */}
      <div className="id-card">
        <div className="id-card__top">
          <div className="id-avatar">{initial}</div>
          <div className="id-card__info">
            <span className="id-role">{user?.jabatan || user?.role || 'Karyawan'}</span>
            <div className="id-name">{user?.nama_karyawan || '—'}</div>
            <div className="id-meta">
              {user?.departemen || '—'} · ID {user?.id_karyawan || '-'}
            </div>
          </div>
        </div>
        <div className="id-stats">
          <div className="id-stat">
            <span className="id-stat__label">Status</span>
            <span className="id-stat__value">{user?.status_karyawan || 'Aktif'}</span>
          </div>
          <div className="id-stat">
            <span className="id-stat__label">Bergabung</span>
            <span className="id-stat__value">{user?.tgl_gabung || '—'}</span>
          </div>
        </div>
      </div>

      {/* ===== Info Detail ===== */}
      <div className="card">
        <div className="card-head">
          <div className="card-head__icon"><IconFolder /></div>
          <div>
            <h2 className="card-head__title">Informasi Karyawan</h2>
            <p className="card-head__desc">Detail data pribadi kamu</p>
          </div>
        </div>

        <div className="profile-grid">
          <div className="profile-item">
            <span className="profile-item__label">Tempat Lahir</span>
            <span className="profile-item__value">{user?.tempat_lahir || '—'}</span>
          </div>
          <div className="profile-item">
            <span className="profile-item__label">Tanggal Lahir</span>
            <span className="profile-item__value">{user?.tgl_lahir || '—'}</span>
          </div>
          <div className="profile-item">
            <span className="profile-item__label">No. HP</span>
            <span className="profile-item__value">{user?.no_hp || '—'}</span>
          </div>
          <div className="profile-item">
            <span className="profile-item__label">Status Nikah</span>
            <span className="profile-item__value">{user?.status_nikah || '—'}</span>
          </div>
          <div className="profile-item">
            <span className="profile-item__label">Kontak Darurat</span>
            <span className="profile-item__value">{user?.kontak_darurat || '—'}</span>
          </div>
          <div className="profile-item profile-item--full">
            <span className="profile-item__label">Alamat Domisili</span>
            <span className="profile-item__value">{user?.alamat_domisili || '—'}</span>
          </div>
        </div>
      </div>

      {/* ===== Settings Modal ===== */}
      <Modal
        open={settingsOpen}
        title="Pengaturan"
        icon="warn"
        onClose={() => setSettingsOpen(false)}
      >
        <div className="tab-nav">
          <button className={`tab-btn${settingsTab === 'data' ? ' active' : ''}`} onClick={() => setSettingsTab('data')}>
            <IconPen /> Perbarui Data
          </button>
          <button className={`tab-btn${settingsTab === 'pin' ? ' active' : ''}`} onClick={() => setSettingsTab('pin')}>
            <IconLock /> Ganti PIN
          </button>
        </div>

        {settingsTab === 'data' && (
          <form onSubmit={saveBukuInduk} noValidate>
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
              {errors.tempat_lahir && <div className="form-hint" style={{ color: '#ef4444' }}>{errors.tempat_lahir}</div>}
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
                {errors.tgl_lahir && <div className="form-hint" style={{ color: '#ef4444' }}>{errors.tgl_lahir}</div>}
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
                {errors.status_nikah && <div className="form-hint" style={{ color: '#ef4444' }}>{errors.status_nikah}</div>}
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
              {errors.no_hp && <div className="form-hint" style={{ color: '#ef4444' }}>{errors.no_hp}</div>}
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
            {errors.alamat_domisili && <div className="form-hint" style={{ color: '#ef4444' }}>{errors.alamat_domisili}</div>}
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
            {errors.kontak_darurat && <div className="form-hint" style={{ color: '#ef4444' }}>{errors.kontak_darurat}</div>}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={savingBuku}>
            {savingBuku ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>
        )}

        {settingsTab === 'pin' && (
          <form onSubmit={savePin} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="pin_lama">PIN Lama</label>
            <input
              id="pin_lama"
              className={`form-input${pinErrors.pin_lama ? ' input-error' : ''}`}
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="6 digit angka"
              value={pin.pin_lama}
              onChange={(e) => handlePin('pin_lama', e.target.value.replace(/\D/g, ''))}
              autoComplete="current-password"
            />
            {pinErrors.pin_lama && <div className="form-hint" style={{ color: '#ef4444' }}>{pinErrors.pin_lama}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="pin_baru">PIN Baru</label>
              <input
                id="pin_baru"
                className={`form-input${pinErrors.pin_baru ? ' input-error' : ''}`}
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="6 digit angka"
                value={pin.pin_baru}
                onChange={(e) => handlePin('pin_baru', e.target.value.replace(/\D/g, ''))}
                autoComplete="new-password"
              />
              {pinErrors.pin_baru && <div className="form-hint" style={{ color: '#ef4444' }}>{pinErrors.pin_baru}</div>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pin_konfirmasi">Konfirmasi PIN Baru</label>
              <input
                id="pin_konfirmasi"
                className={`form-input${pinErrors.pin_konfirmasi ? ' input-error' : ''}`}
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="6 digit angka"
                value={pin.pin_konfirmasi}
                onChange={(e) => handlePin('pin_konfirmasi', e.target.value.replace(/\D/g, ''))}
                autoComplete="new-password"
              />
              {pinErrors.pin_konfirmasi && <div className="form-hint" style={{ color: '#ef4444' }}>{pinErrors.pin_konfirmasi}</div>}
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={savingPin}>
            {savingPin ? 'Menyimpan...' : 'Ganti PIN'}
          </button>
        </form>
        )}

        <div className="settings-footer">
          <button className="btn-danger" onClick={handleLogout}><IconDoor /> Keluar / Log Out</button>
        </div>
      </Modal>

      <Modal
        open={!!modal}
        title={modal?.title}
        icon={modal?.icon}
        msg={modal?.msg}
        onClose={modal?.type === 'alert' ? closeModal : undefined}
      >
        {modal?.type === 'alert' && (
          <div className="modal-btns">
            <button className="btn btn-primary" style={{ width: 'auto', padding: '12px 24px' }} onClick={closeModal}>
              OK Mengerti
            </button>
          </div>
        )}
        {modal?.type === 'confirm' && (
          <div className="modal-btns">
            <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={closeModal}>Batal</button>
            <button className="btn btn-primary" style={{ width: 'auto', padding: '12px 24px' }} onClick={doLogout}>
              Yakin, Keluar
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}

