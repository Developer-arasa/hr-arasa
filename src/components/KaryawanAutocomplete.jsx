import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Autocomplete ketat: input ID/Nama karyawan dengan saran dari master_data.
 * - `mode`: 'ID' atau 'NAMA'
 * - `value` + `onChange`: input utama
 * - `onSelect`: dipanggil saat karyawan valid dipilih (objek karyawan penuh)
 */
export default function KaryawanAutocomplete({ mode, value, onChange, onSelect, placeholder }) {
  const [master, setMaster] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    supabase
      .from('master_data')
      .select('*')
      .order('nama_karyawan')
      .then(({ data }) => setMaster(data || []));
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function doSearch(val) {
    const v = (val || '').toLowerCase();
    const filtered = mode === 'ID'
      ? master.filter((k) => String(k.id_karyawan).toLowerCase().includes(v))
      : master.filter((k) => (k.nama_karyawan || '').toLowerCase().includes(v));
    setSuggestions(filtered);
    setOpen(true);
  }

  function validateExact(val) {
    const v = (val || '').toLowerCase();
    const exact = mode === 'ID'
      ? master.find((k) => String(k.id_karyawan).toLowerCase() === v)
      : master.find((k) => (k.nama_karyawan || '').toLowerCase() === v);
    if (exact) {
      onSelect(exact);
      setError(false);
    } else if (val) {
      onSelect(null);
      setError(true);
    }
    setOpen(false);
  }

  function handlePick(k) {
    if (mode === 'ID') onChange(String(k.id_karyawan));
    else onChange(k.nama_karyawan);
    onSelect(k);
    setError(false);
    setOpen(false);
  }

  return (
    <div className="select-wrapper" ref={wrapRef}>
      <input
        type="text"
        className={`form-input${error ? ' input-error' : ''}`}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          onSelect(null);
          doSearch(e.target.value);
        }}
        onFocus={(e) => doSearch(e.target.value)}
        onBlur={(e) => validateExact(e.target.value)}
      />
      {open && (
        <div className="autocomplete-list" style={{ display: 'block' }}>
          {suggestions.length === 0 ? (
            <div className="autocomplete-item" style={{ color: '#ef4444', fontWeight: 600, cursor: 'default' }}>
              ❌ Tidak ditemukan di master data
            </div>
          ) : (
            suggestions.map((k) => (
              <div
                key={k.id_karyawan}
                className="autocomplete-item"
                onMouseDown={(e) => { e.preventDefault(); handlePick(k); }}
              >
                {mode === 'ID' ? (
                  <>
                    <strong style={{ color: 'var(--accent)' }}>{k.id_karyawan}</strong>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{k.nama_karyawan}</span>
                  </>
                ) : (
                  <>
                    <strong>{k.nama_karyawan}</strong>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>ID: {k.id_karyawan}</span>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
