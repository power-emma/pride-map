import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Category = { id: number; name: string };

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

export default function CreateLocationPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [url, setUrl] = useState('');
  const [categoryId, setCategoryId] = useState<string>(''); // '' = no category

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingCategories(true);
    setCategoriesError(null);

    fetch('/api/categories')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load categories (${res.status})`);
        return res.json();
      })
      .then((json: Category[]) => {
        if (cancelled) return;
        setCategories(json);
      })
      .catch((err) => {
        if (cancelled) return;
        setCategoriesError(err instanceof Error ? err.message : 'Failed to load categories');
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingCategories(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = useMemo(() => {
    return name.trim().length > 0 && !submitting;
  }, [name, submitting]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    const lat = toNullableNumber(latitude);
    const lng = toNullableNumber(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setSubmitError('Latitude/Longitude must be valid numbers (or left blank).');
      return;
    }

    const payload = {
      name: name.trim(),
      description: toNullIfEmpty(description),
      address: toNullIfEmpty(address),
      latitude: lat,
      longitude: lng,
      url: toNullIfEmpty(url),
      id_category: categoryId === '' ? null : Number(categoryId),
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          (json && typeof json === 'object' && 'error' in json && typeof (json as any).error === 'string'
            ? (json as any).error
            : `Failed to create location (${res.status})`);
        setSubmitError(message);
        return;
      }

      setSubmitSuccess('Location created.');
      setName('');
      setDescription('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setUrl('');
      setCategoryId('');

      // Small UX: return home after a brief beat
      setTimeout(() => navigate('/'), 400);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create location');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '1rem' }}>
      <h2 style={{ margin: '0 0 0.75rem 0' }}>Add a Location</h2>

      {categoriesError && (
        <div style={{ padding: '0.75rem', border: '1px solid #ff5a5a', borderRadius: 8, marginBottom: '0.75rem' }}>
          {categoriesError}
        </div>
      )}

      {submitError && (
        <div style={{ padding: '0.75rem', border: '1px solid #ff5a5a', borderRadius: 8, marginBottom: '0.75rem' }}>
          {submitError}
        </div>
      )}

      {submitSuccess && (
        <div style={{ padding: '0.75rem', border: '1px solid #4caf50', borderRadius: 8, marginBottom: '0.75rem' }}>
          {submitSuccess}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>Name *</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Location name"
            style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid #444' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>Category</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={loadingCategories}
            style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid #444' }}
          >
            <option value="">{loadingCategories ? 'Loading…' : 'No category'}</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={4}
            style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid #444' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>Address</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Optional address"
            style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid #444' }}
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontWeight: 600 }}>Latitude</span>
            <input
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="e.g. 45.421"
              inputMode="decimal"
              style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid #444' }}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontWeight: 600 }}>Longitude</span>
            <input
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="e.g. -75.690"
              inputMode="decimal"
              style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid #444' }}
            />
          </label>
        </div>
        <div style={{ marginTop: '-0.35rem', opacity: 0.85, fontSize: 14 }}>
          Coordinates are optional, but required if you want the location to appear as a map pin.
        </div>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>Website URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.org"
            style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid #444' }}
          />
        </label>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.25rem' }}>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              padding: '0.65rem 0.9rem',
              borderRadius: 10,
              border: '1px solid #444',
              fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Creating…' : 'Create Location'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{ padding: '0.65rem 0.9rem', borderRadius: 10, border: '1px solid #444', fontWeight: 600 }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

