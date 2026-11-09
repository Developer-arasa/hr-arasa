import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import {
  IconCog, IconFolder, IconPen, IconLock, IconDoor, IconUser,
  IconCal, IconChevronRight, IconChevronLeft, IconCheck, IconBrand,
  IconHome, IconWarn, IconBriefcase, IconClock, IconLogout
} from '../components/Icons';
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
  })
  .refine((d) => d.pin_baru !== '123456', {
    message: 'PIN baru tidak boleh memakai PIN bawaan (123456)',
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
      setModal({ type: 'alert', icon: 'error', title: 'Gagal', msg: 'Gagal menyimpan perubahan. Coba lagi nanti.' });
      return;
    }

    await refreshUser();
    setSettingsOpen(false);
    setModal({ type: 'alert', icon: 'success', title: 'Berhasil', msg: 'Biodata karyawan berhasil diperbarui.' });
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

    setSavingPin(true);

    const { data: check, error: checkErr } = await supabase
      .from('master_data')
      .select('id_karyawan')
      .eq('id_karyawan', user.id_karyawan)
      .eq('pin', parsed.data.pin_lama)
      .maybeSingle();

    if (checkErr || !check) {
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
    setSettingsOpen(false);
    setModal({ type: 'alert', icon: 'success', title: 'Berhasil', msg: 'PIN keamanan berhasil diganti.' });
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
    <div className="page-enter" style={{ paddingBottom: 60 }}>
      {/* ============================================================
          BIODATA ASYMMETRIC HERO HEADER (MODYCHAT STYLE)
          ============================================================ */}
      <div className="biodata-hero-header">
        {/* Top Navigation Bar */}
        <div className="biodata-top-bar">
          <Link to="/" className="focal-back-btn" title="Kembali ke Dashboard">
            <IconChevronLeft style={{ width: 18, height: 18 }} />
          </Link>

          <div className="focal-center-pill">
            <span>Biodata & Akun</span>
          </div>

          <button
            type="button"
            className="biodata-edit-btn"
            title="Ubah Biodata"
            onClick={() => { setSettingsTab('data'); setSettingsOpen(true); }}
          >
            <IconPen style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Avatar & Focal Identity */}
        <div className="biodata-avatar-section">
          <div className="biodata-avatar-frame">
            <div className="biodata-avatar-box">
              {initial}
            </div>
            <div className="biodata-verified-badge" title="Status Terverifikasi HRD">
              <IconCheck style={{ width: 13, height: 13 }} />
            </div>
          </div>

          <h1 className="biodata-name">
            {user?.nama_karyawan || 'Karyawan Arasa'}
          </h1>

          <div className="biodata-meta">
            <span style={{ color: '#38bdf8' }}>ID: {user?.id_karyawan || '—'}</span>
            <span>•</span>
            <span>{user?.jabatan || user?.role || 'Staff'}</span>
            <span>•</span>
            <span style={{ color: '#94a3b8' }}>{user?.departemen || 'Operasional'}</span>
          </div>
        </div>
      </div>

      {/* ============================================================
          OVERLAPPING SUMMARY STRIP ("NUMPUK" WITH ASYMMETRIC CORNERS)
          ============================================================ */}
      <div className="biodata-summary-strip">
        <div className="biodata-strip-col">
          <div className="biodata-strip-label">Status</div>
          <div className="biodata-strip-val" style={{ color: '#10b981' }}>
            {user?.status_karyawan || 'Aktif'}
          </div>
        </div>

        <div className="biodata-strip-col">
          <div className="biodata-strip-label">Hak Cuti</div>
          <div className="biodata-strip-val" style={{ color: '#2563eb' }}>
            {user?.jatah_cuti ?? 12} Hari
          </div>
        </div>

        <div className="biodata-strip-col">
          <div className="biodata-strip-label">Bergabung</div>
          <div className="biodata-strip-val" style={{ color: 'var(--text-heading)' }}>
            {user?.tgl_masuk ? user.tgl_masuk.slice(0, 4) : '2026'}
          </div>
        </div>
      </div>

      {/* ============================================================
          SECTION 1: BUKU INDUK KARYAWAN (GROUPED SETTINGS STYLE)
          ============================================================ */}
      <div className="biodata-group-card">
        <div className="biodata-group-head">
          <div>
            <h2 className="biodata-group-title">Buku Induk Karyawan</h2>
            <div className="biodata-group-sub">Informasi data diri resmi terdaftar di HRD</div>
          </div>
          <button
            type="button"
            onClick={() => { setSettingsTab('data'); setSettingsOpen(true); }}
            style={{
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              border: 'none',
              borderRadius: '12px 6px 12px 12px',
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <IconPen style={{ width: 12, height: 12 }} />
            <span>Ubah</span>
          </button>
        </div>

        {/* Row 1: Tempat & Tanggal Lahir */}
        <div className="biodata-row-item">
          <div className="biodata-row-left">
            <div className="biodata-row-squircle" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <IconCal style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div className="biodata-row-label">Tempat, Tanggal Lahir</div>
              <div className="biodata-row-val">
                {user?.tempat_lahir ? `${user.tempat_lahir}, ` : ''}{user?.tgl_lahir || 'Belum diisi'}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: WhatsApp / No HP */}
        <div className="biodata-row-item">
          <div className="biodata-row-left">
            <div className="biodata-row-squircle" style={{ background: '#ecfdf5', color: '#059669' }}>
              <IconDoor style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div className="biodata-row-label">No. WhatsApp / HP</div>
              <div className="biodata-row-val">
                {user?.no_hp || 'Belum diisi'}
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Status Pernikahan */}
        <div className="biodata-row-item">
          <div className="biodata-row-left">
            <div className="biodata-row-squircle" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              <IconUser style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div className="biodata-row-label">Status Pernikahan</div>
              <div className="biodata-row-val">
                {user?.status_nikah || 'Belum diisi'}
              </div>
            </div>
          </div>
        </div>

        {/* Row 4: Kontak Darurat */}
        <div className="biodata-row-item">
          <div className="biodata-row-left">
            <div className="biodata-row-squircle" style={{ background: '#fffbeb', color: '#d97706' }}>
              <IconWarn style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div className="biodata-row-label">Kontak Darurat (Keluarga)</div>
              <div className="biodata-row-val">
                {user?.kontak_darurat || 'Belum diisi'}
              </div>
            </div>
          </div>
        </div>

        {/* Row 5: Alamat Domisili */}
        <div className="biodata-row-item">
          <div className="biodata-row-left">
            <div className="biodata-row-squircle" style={{ background: '#f1f5f9', color: '#475569' }}>
              <IconHome style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div className="biodata-row-label">Alamat Domisili</div>
              <div className="biodata-row-val">
                {user?.alamat_domisili || 'Belum diisi'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          SECTION 2: KEPEGAWAIAN RESMI (SETTING STYLE ROWS)
          ============================================================ */}
      <div className="biodata-group-card">
        <div className="biodata-group-head">
          <div>
            <h2 className="biodata-group-title">Data Kepegawaian</h2>
            <div className="biodata-group-sub">Informasi penempatan & perizinan kerja</div>
          </div>
        </div>

        {/* Jabatan & Departemen */}
        <div className="biodata-row-item">
          <div className="biodata-row-left">
            <div className="biodata-row-squircle" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <IconBriefcase style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div className="biodata-row-label">Posisi & Divisi</div>
              <div className="biodata-row-val">
                {user?.jabatan || user?.role || 'Karyawan'} • {user?.departemen || 'Operasional'}
              </div>
            </div>
          </div>
        </div>

        {/* Hak Cuti Tahunan */}
        <div className="biodata-row-item">
          <div className="biodata-row-left">
            <div className="biodata-row-squircle" style={{ background: '#ecfdf5', color: '#059669' }}>
              <IconCal style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div className="biodata-row-label">Hak Cuti Tahunan</div>
              <div className="biodata-row-val">
                {user?.jatah_cuti ?? 12} Hari Kerja
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          SECTION 3: KEAMANAN & AKUN (MODYCHAT SETTINGS STYLE)
          ============================================================ */}
      <div className="biodata-group-card">
        <div className="biodata-group-head">
          <div>
            <h2 className="biodata-group-title">Keamanan & Akses</h2>
            <div className="biodata-group-sub">Kredensial login portal Arasa HR</div>
          </div>
        </div>

        {/* Ganti PIN */}
        <div
          className="biodata-row-item interactive"
          onClick={() => { setSettingsTab('pin'); setSettingsOpen(true); }}
        >
          <div className="biodata-row-left">
            <div className="biodata-row-squircle" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              <IconLock style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div className="biodata-row-label">Keamanan Akses</div>
              <div className="biodata-row-val">Ganti PIN Masuk (6 Digit)</div>
            </div>
          </div>
          <IconChevronRight style={{ width: 18, height: 18, color: '#94a3b8' }} />
        </div>

        {/* Logout */}
        <div
          className="biodata-row-item interactive"
          onClick={handleLogout}
        >
          <div className="biodata-row-left">
            <div className="biodata-row-squircle" style={{ background: '#fef2f2', color: '#ef4444' }}>
              <IconLogout style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div className="biodata-row-label" style={{ color: '#ef4444' }}>Sesi Login</div>
              <div className="biodata-row-val" style={{ color: '#ef4444' }}>Keluar dari Akun</div>
            </div>
          </div>
          <IconChevronRight style={{ width: 18, height: 18, color: '#ef4444' }} />
        </div>
      </div>

      {/* ============================================================
          MODAL: EDIT BUKU INDUK / GANTI PIN
          ============================================================ */}
      <Modal
        open={settingsOpen}
        title={settingsTab === 'data' ? 'Perbarui Biodata Karyawan' : 'Ganti PIN Keamanan'}
        alignLeft
        onClose={() => setSettingsOpen(false)}
      >
        <div style={{
          display: 'flex',
          gap: 8,
          background: '#f1f5f9',
          padding: 4,
          borderRadius: 14,
          marginBottom: 16
        }}>
          <button
            type="button"
            className={`segmented-tab-btn ${settingsTab === 'data' ? 'active' : ''}`}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '12px 6px 12px 12px',
              fontSize: 12,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: settingsTab === 'data' ? '#ffffff' : 'transparent',
              color: settingsTab === 'data' ? 'var(--accent)' : 'var(--text-muted)',
              boxShadow: settingsTab === 'data' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
            onClick={() => setSettingsTab('data')}
          >
            <IconPen style={{ width: 14, height: 14 }} /> Biodata
          </button>

          <button
            type="button"
            className={`segmented-tab-btn ${settingsTab === 'pin' ? 'active' : ''}`}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '12px 6px 12px 12px',
              fontSize: 12,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: settingsTab === 'pin' ? '#ffffff' : 'transparent',
              color: settingsTab === 'pin' ? 'var(--accent)' : 'var(--text-muted)',
              boxShadow: settingsTab === 'pin' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
            onClick={() => setSettingsTab('pin')}
          >
            <IconLock style={{ width: 14, height: 14 }} /> Ganti PIN
          </button>
        </div>

        {/* Tab Biodata */}
        {settingsTab === 'data' && (
          <div key="data" className="subtab-spring-enter">
            <form onSubmit={saveBukuInduk} noValidate>
              <div style={{ marginBottom: 12, textAlign: 'left' }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Tempat Lahir</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Contoh: Jakarta"
                  value={form.tempat_lahir}
                  onChange={(e) => handleField('tempat_lahir', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '14px 6px 14px 14px', border: '1px solid var(--border)', fontSize: 13 }}
                />
                {errors.tempat_lahir && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>{errors.tempat_lahir}</div>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12, textAlign: 'left' }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Tanggal Lahir</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.tgl_lahir}
                    onChange={(e) => handleField('tgl_lahir', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '14px 6px 14px 14px', border: '1px solid var(--border)', fontSize: 13 }}
                  />
                  {errors.tgl_lahir && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>{errors.tgl_lahir}</div>}
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Status Nikah</label>
                  <select
                    className="form-select"
                    value={form.status_nikah}
                    onChange={(e) => handleField('status_nikah', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '14px 6px 14px 14px', border: '1px solid var(--border)', fontSize: 13, background: '#fff' }}
                  >
                    <option value="">Pilih status</option>
                    <option value="Belum Menikah">Belum Menikah</option>
                    <option value="Menikah">Menikah</option>
                    <option value="Cerai Hidup">Cerai Hidup</option>
                    <option value="Cerai Mati">Cerai Mati</option>
                  </select>
                  {errors.status_nikah && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>{errors.status_nikah}</div>}
                </div>
              </div>

              <div style={{ marginBottom: 12, textAlign: 'left' }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>No. WhatsApp / HP</label>
                <input
                  className="form-input"
                  type="tel"
                  placeholder="Contoh: 081234567890"
                  value={form.no_hp}
                  onChange={(e) => handleField('no_hp', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '14px 6px 14px 14px', border: '1px solid var(--border)', fontSize: 13 }}
                />
                {errors.no_hp && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>{errors.no_hp}</div>}
              </div>

              <div style={{ marginBottom: 12, textAlign: 'left' }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Kontak Darurat (Keluarga)</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Nama & No. HP (misal: Ayah 0812...)"
                  value={form.kontak_darurat}
                  onChange={(e) => handleField('kontak_darurat', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '14px 6px 14px 14px', border: '1px solid var(--border)', fontSize: 13 }}
                />
                {errors.kontak_darurat && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>{errors.kontak_darurat}</div>}
              </div>

              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Alamat Domisili</label>
                <textarea
                  rows="2"
                  className="form-textarea"
                  placeholder="Alamat tempat tinggal lengkap..."
                  value={form.alamat_domisili}
                  onChange={(e) => handleField('alamat_domisili', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '14px 6px 14px 14px', border: '1px solid var(--border)', fontSize: 13, resize: 'vertical' }}
                />
                {errors.alamat_domisili && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>{errors.alamat_domisili}</div>}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, borderRadius: '14px 6px 14px 14px' }} onClick={() => setSettingsOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, borderRadius: '14px 6px 14px 14px' }} disabled={savingBuku}>
                  {savingBuku ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab Ganti PIN */}
        {settingsTab === 'pin' && (
          <div key="pin" className="subtab-spring-enter">
            <form onSubmit={savePin} noValidate>
              <div style={{ marginBottom: 12, textAlign: 'left' }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>PIN Saat Ini</label>
                <input
                  className="form-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6 digit PIN lama"
                  value={pin.pin_lama}
                  onChange={(e) => handlePin('pin_lama', e.target.value.replace(/\D/g, ''))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '14px 6px 14px 14px', border: '1px solid var(--border)', fontSize: 13 }}
                />
                {pinErrors.pin_lama && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>{pinErrors.pin_lama}</div>}
              </div>

              <div style={{ marginBottom: 12, textAlign: 'left' }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>PIN Baru</label>
                <input
                  className="form-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6 digit PIN baru"
                  value={pin.pin_baru}
                  onChange={(e) => handlePin('pin_baru', e.target.value.replace(/\D/g, ''))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '14px 6px 14px 14px', border: '1px solid var(--border)', fontSize: 13 }}
                />
                {pinErrors.pin_baru && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>{pinErrors.pin_baru}</div>}
              </div>

              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Konfirmasi PIN Baru</label>
                <input
                  className="form-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Konfirmasi 6 digit PIN"
                  value={pin.pin_konfirmasi}
                  onChange={(e) => handlePin('pin_konfirmasi', e.target.value.replace(/\D/g, ''))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '14px 6px 14px 14px', border: '1px solid var(--border)', fontSize: 13 }}
                />
                {pinErrors.pin_konfirmasi && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>{pinErrors.pin_konfirmasi}</div>}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, borderRadius: '14px 6px 14px 14px' }} onClick={() => setSettingsOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, borderRadius: '14px 6px 14px 14px' }} disabled={savingPin}>
                  {savingPin ? 'Menyimpan...' : 'Perbarui PIN'}
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        open={!!modal}
        title={modal?.title}
        icon={modal?.icon}
        msg={modal?.msg}
        onClose={modal?.type === 'alert' ? closeModal : undefined}
      >
        {modal?.type === 'alert' && (
          <div className="modal-btns">
            <button className="btn btn-primary" style={{ width: '100%', borderRadius: 14 }} onClick={closeModal}>OK Mengerti</button>
          </div>
        )}
        {modal?.type === 'confirm' && (
          <div className="modal-btns" style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1, borderRadius: 14 }} onClick={closeModal}>Batal</button>
            <button className="btn btn-primary" style={{ flex: 1, borderRadius: 14, background: 'var(--danger-text)' }} onClick={doLogout}>Ya, Keluar</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
