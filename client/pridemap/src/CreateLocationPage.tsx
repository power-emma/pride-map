import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CategoryCheckboxes from './components/CategoryCheckboxes';

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
  const [categoryIds, setCategoryIds] = useState<number[]>([]);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [geocodeResults, setGeocodeResults] = useState<Array<{ displayName: string; latitude: string; longitude: string }>>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

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

  async function handleGeocode() {
    const query = address.trim();
    if (!query) {
      setGeocodeResults([]);
      setGeocodeError('Enter a street address before geocoding.');
      return;
    }

    setGeocodeError(null);
    setGeocoding(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error(`Geocoding failed (${response.status})`);
      }

      const data = (await response.json()) as Array<{ display_name?: string; lat?: string; lon?: string }>;
      const results = data
        .filter((item) => typeof item.display_name === 'string' && item.lat && item.lon)
        .map((item) => ({
          displayName: item.display_name as string,
          latitude: String(item.lat),
          longitude: String(item.lon),
        }))
        .filter((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));

      if (results.length === 0) {
        setGeocodeResults([]);
        setGeocodeError('No matching addresses found. Try a more specific street address.');
        return;
      }

      setGeocodeResults(results);
    } catch (err) {
      setGeocodeResults([]);
      setGeocodeError(err instanceof Error ? err.message : 'Could not geocode this address.');
    } finally {
      setGeocoding(false);
    }
  }

  function handleSelectGeocodeResult(result: { displayName: string; latitude: string; longitude: string }) {
    setAddress(result.displayName);
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    setGeocodeResults([]);
    setGeocodeError(null);
  }

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
      category_ids: categoryIds,
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
      setCategoryIds([]);
      setGeocodeResults([]);
      setGeocodeError(null);

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

        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>Categories</span>
          <CategoryCheckboxes
            categories={categories}
            loading={loadingCategories}
            selected={categoryIds}
            onChange={setCategoryIds}
          />
        </div>

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

        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>Address</span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'start' }}>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Optional address"
              style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid #444' }}
            />
            <button
              type="button"
              onClick={handleGeocode}
              disabled={geocoding || address.trim().length === 0}
              style={{
                padding: '0.6rem 0.9rem',
                borderRadius: 8,
                border: '1px solid #444',
                fontWeight: 700,
                cursor: geocoding || address.trim().length === 0 ? 'not-allowed' : 'pointer',
                opacity: geocoding || address.trim().length === 0 ? 0.65 : 1,
              }}
            >
              {geocoding ? 'Geocoding…' : 'Geocode'}
            </button>
          </div>

          {geocodeError && (
            <div style={{ color: '#ff9a9a', fontSize: 13 }}>{geocodeError}</div>
          )}

          {geocodeResults.length > 0 && (
            <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.35rem' }}>
              {geocodeResults.map((result) => (
                <button
                  key={`${result.displayName}-${result.latitude}-${result.longitude}`}
                  type="button"
                  onClick={() => handleSelectGeocodeResult(result)}
                  style={{
                    textAlign: 'left',
                    padding: '0.55rem 0.7rem',
                    borderRadius: 8,
                    border: '1px solid #444',
                    background: '#1f1f1f',
                    color: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {result.displayName}
                </button>
              ))}
            </div>
          )}
        </div>

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

