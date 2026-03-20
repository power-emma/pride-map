import { useEffect, useMemo, useState } from 'react';
import CategoryCheckboxes from './components/CategoryCheckboxes';

type Category = { id: number; name: string };

type Location = {
  id: number;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  url: string | null;
  category_ids: number[];
};

function toNullIfEmpty(value: string) {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function toNullableNumber(value: string) {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : NaN;
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem',
  borderRadius: 8,
  border: '1px solid #444',
  background: '#1a1a1a',
  color: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.3rem',
};

export default function ManageLocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 'idle' = nothing selected, 'edit' = editing existing, 'create' = new location form
  const [mode, setMode] = useState<'idle' | 'edit' | 'create'>('idle');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  // Shared form state (used for both edit and create)
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [url, setUrl] = useState('');
  const [categoryIds, setCategoryIds] = useState<number[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/locations').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ])
      .then(([locs, cats]) => {
        setLocations(locs);
        setCategories(cats);
      })
      .catch(err => setLoadError(err.message ?? 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  const filteredLocations = useMemo(() => {
    const q = search.toLowerCase();
    return locations.filter(l => l.name.toLowerCase().includes(q));
  }, [locations, search]);

  function clearForm() {
    setName('');
    setDescription('');
    setAddress('');
    setLatitude('');
    setLongitude('');
    setUrl('');
    setCategoryIds([]);
    setSaveError(null);
    setSaveSuccess(null);
    setConfirmDelete(false);
  }

  function selectLocation(loc: Location) {
    clearForm();
    setSelectedId(loc.id);
    setMode('edit');
    setName(loc.name);
    setDescription(loc.description ?? '');
    setAddress(loc.address ?? '');
    setLatitude(loc.latitude != null ? String(loc.latitude) : '');
    setLongitude(loc.longitude != null ? String(loc.longitude) : '');
    setUrl(loc.url ?? '');
    setCategoryIds(loc.category_ids);
  }

  function openCreate() {
    clearForm();
    setSelectedId(null);
    setMode('create');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (selectedId == null) return;
    setSaveError(null);
    setSaveSuccess(null);

    const lat = toNullableNumber(latitude);
    const lng = toNullableNumber(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setSaveError('Latitude/Longitude must be valid numbers (or left blank).');
      return;
    }

    const payload = {
      name: name.trim(),
      description: toNullIfEmpty(description),
      address: toNullIfEmpty(address),
      latitude: lat,
      longitude: lng,
      url: toNullIfEmpty(url),
      category_ids: categoryIds,
    };

    setSaving(true);
    try {
      const res = await fetch(`/api/locations/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveError(json?.error ?? `Failed to save (${res.status})`);
        return;
      }

      setLocations(prev =>
        prev.map(l =>
          l.id === selectedId
            ? { ...l, ...payload }
            : l
        )
      );
      setSaveSuccess('Saved successfully.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    const lat = toNullableNumber(latitude);
    const lng = toNullableNumber(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setSaveError('Latitude/Longitude must be valid numbers (or left blank).');
      return;
    }

    const payload = {
      name: name.trim(),
      description: toNullIfEmpty(description),
      address: toNullIfEmpty(address),
      latitude: lat,
      longitude: lng,
      url: toNullIfEmpty(url),
      category_ids: categoryIds,
    };

    setSaving(true);
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveError(json?.error ?? `Failed to create (${res.status})`);
        return;
      }

      const newLoc: Location = { id: json.id, ...payload, category_ids: payload.category_ids };
      setLocations(prev => [...prev, newLoc].sort((a, b) => a.name.localeCompare(b.name)));
      setSaveSuccess('Location created.');
      // Switch to editing the new location
      setSelectedId(json.id);
      setMode('edit');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (selectedId == null) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/locations/${selectedId}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveError(json?.error ?? `Failed to delete (${res.status})`);
        setDeleting(false);
        return;
      }
      setLocations(prev => prev.filter(l => l.id !== selectedId));
      setSelectedId(null);
      setMode('idle');
      setConfirmDelete(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  const selectedLocation = locations.find(l => l.id === selectedId) ?? null;

  if (loading) return <div style={{ padding: '2rem' }}>Loading…</div>;
  if (loadError) return <div style={{ padding: '2rem', color: '#ff5a5a' }}>Error: {loadError}</div>;

  const sharedForm = (isCreate: boolean) => (
    <form onSubmit={isCreate ? handleCreate : handleSave} style={{ display: 'grid', gap: '0.75rem' }}>
      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>Name *</span>
        <input value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
      </label>

      <div style={labelStyle}>
        <span style={{ fontWeight: 600 }}>Categories</span>
        <CategoryCheckboxes
          categories={categories}
          loading={false}
          selected={categoryIds}
          onChange={setCategoryIds}
        />
      </div>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>Description</span>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} style={inputStyle} />
      </label>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>Address</span>
        <input value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <label style={labelStyle}>
          <span style={{ fontWeight: 600 }}>Latitude</span>
          <input value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="e.g. 45.421" inputMode="decimal" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          <span style={{ fontWeight: 600 }}>Longitude</span>
          <input value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="e.g. -75.690" inputMode="decimal" style={inputStyle} />
        </label>
      </div>
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        Coordinates are optional but required for a map pin.
      </div>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>Website URL</span>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.org" style={inputStyle} />
      </label>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={saving || name.trim().length === 0}
          style={{ padding: '0.6rem 1.1rem', borderRadius: 8, border: '1px solid #444', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? (isCreate ? 'Creating…' : 'Saving…') : (isCreate ? 'Create Location' : 'Save Changes')}
        </button>

        {!isCreate && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              padding: '0.6rem 1.1rem',
              borderRadius: 8,
              border: `1px solid ${confirmDelete ? '#ff5a5a' : '#444'}`,
              fontWeight: 700,
              color: confirmDelete ? '#ff5a5a' : 'inherit',
              cursor: deleting ? 'not-allowed' : 'pointer',
            }}
          >
            {deleting ? 'Deleting…' : confirmDelete ? 'Confirm Delete' : 'Delete'}
          </button>
        )}

        {confirmDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            style={{ padding: '0.6rem 0.9rem', borderRadius: 8, border: '1px solid #444', cursor: 'pointer' }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', height: 'calc(100vh - 72px)', overflow: 'hidden' }}>

      {/* Sidebar */}
      <div style={{ borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem', borderBottom: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            onClick={openCreate}
            style={{
              padding: '0.55rem 0.75rem',
              borderRadius: 8,
              border: '1px solid #555',
              fontWeight: 700,
              cursor: 'pointer',
              background: mode === 'create' ? '#2a2a2a' : 'transparent',
              color: 'inherit',
              textAlign: 'left',
            }}
          >
            + Add Location
          </button>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search locations…"
            style={{ ...inputStyle }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filteredLocations.length === 0 && (
            <div style={{ padding: '1rem', opacity: 0.6 }}>No locations found.</div>
          )}
          {filteredLocations.map(loc => (
            <button
              key={loc.id}
              onClick={() => selectLocation(loc)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.65rem 0.75rem',
                background: loc.id === selectedId && mode === 'edit' ? '#2a2a2a' : 'transparent',
                border: 'none',
                borderBottom: '1px solid #222',
                color: 'inherit',
                cursor: 'pointer',
                fontWeight: loc.id === selectedId && mode === 'edit' ? 700 : 400,
              }}
            >
              <div style={{ fontSize: 14 }}>{loc.name}</div>
              {loc.address && <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>{loc.address}</div>}
            </button>
          ))}
        </div>
        <div style={{ padding: '0.6rem', borderTop: '1px solid #333', fontSize: 12, opacity: 0.5 }}>
          {filteredLocations.length} location{filteredLocations.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ overflowY: 'auto', padding: '1.5rem' }}>
        <div style={{ maxWidth: 640, width: '100%', margin: '0 auto' }}>
        {mode === 'idle' && (
          <div style={{ opacity: 0.5, marginTop: '2rem', textAlign: 'center' }}>
            Select a location to edit it, or click <strong>+ Add Location</strong>.
          </div>
        )}

        {mode === 'create' && (
          <>
            <h2 style={{ margin: '0 0 1rem 0' }}>Add a Location</h2>
            {saveError && <div style={{ padding: '0.75rem', border: '1px solid #ff5a5a', borderRadius: 8, marginBottom: '0.75rem', color: '#ff5a5a' }}>{saveError}</div>}
            {saveSuccess && <div style={{ padding: '0.75rem', border: '1px solid #4caf50', borderRadius: 8, marginBottom: '0.75rem', color: '#4caf50' }}>{saveSuccess}</div>}
            {sharedForm(true)}
          </>
        )}

        {mode === 'edit' && selectedLocation != null && (
          <>
            <h2 style={{ margin: '0 0 1rem 0' }}>Edit: {selectedLocation.name}</h2>
            {saveError && <div style={{ padding: '0.75rem', border: '1px solid #ff5a5a', borderRadius: 8, marginBottom: '0.75rem', color: '#ff5a5a' }}>{saveError}</div>}
            {saveSuccess && <div style={{ padding: '0.75rem', border: '1px solid #4caf50', borderRadius: 8, marginBottom: '0.75rem', color: '#4caf50' }}>{saveSuccess}</div>}
            {sharedForm(false)}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
