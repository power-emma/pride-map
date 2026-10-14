import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CategoryCheckboxes from './components/CategoryCheckboxes';
import TurnstileWidget from './components/TurnstileWidget';
import i18nInstance from './i18n';
import { localizedApiError } from './localizedApiError';

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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function CreateLocationPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionFr, setDescriptionFr] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [url, setUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [categoryIds, setCategoryIds] = useState<number[]>([]);

  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);

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
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((json: Category[]) => {
        if (cancelled) return;
        setCategories(json);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load categories:', err);
        setCategoriesError(i18nInstance.t('errors.network'));
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
    return (
      (name.trim().length > 0 || nameFr.trim().length > 0) &&
      isValidEmail(email) &&
      captchaToken.length > 0 &&
      !submitting
    );
  }, [name, nameFr, email, captchaToken, submitting]);

  async function handleGeocode() {
    const query = address.trim();
    if (!query) {
      setGeocodeResults([]);
      setGeocodeError(t('create.geocodeAddress'));
      return;
    }

    setGeocodeError(null);
    setGeocoding(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=${i18n.language.startsWith('fr') ? 'fr' : 'en'}&q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error(String(response.status));
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
        setGeocodeError(t('create.noAddresses'));
        return;
      }

      setGeocodeResults(results);
    } catch (err) {
      setGeocodeResults([]);
      console.error('Could not geocode address:', err);
      setGeocodeError(t('create.geocodeFailed'));
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

    if (!isValidEmail(email)) {
      setSubmitError(t('create.validEmail'));
      return;
    }
    if (!captchaToken) {
      setSubmitError(t('create.completeCaptcha'));
      return;
    }

    const lat = toNullableNumber(latitude);
    const lng = toNullableNumber(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setSubmitError(t('create.validCoordinates'));
      return;
    }

    const payload = {
      name: name.trim(),
      name_fr: toNullIfEmpty(nameFr),
      submitter_email: email.trim(),
      description: toNullIfEmpty(description),
      description_fr: toNullIfEmpty(descriptionFr),
      address: toNullIfEmpty(address),
      latitude: lat,
      longitude: lng,
      url: toNullIfEmpty(url),
      image_url: toNullIfEmpty(imageUrl),
      category_ids: categoryIds,
      captchaToken,
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const errorCode = json !== null && typeof json === 'object' && 'code' in json
          ? json.code
          : null;
        setSubmitError(localizedApiError(errorCode, res.status));
        // Token is single-use; force the user to solve a fresh challenge.
        setCaptchaToken('');
        setCaptchaResetSignal((n) => n + 1);
        return;
      }

      setSubmitSuccess(t('create.submissionThanks'));
      setName('');
      setNameFr('');
      setEmail('');
      setDescription('');
      setDescriptionFr('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setUrl('');
      setImageUrl('');
      setCategoryIds([]);
      setCaptchaToken('');
      setCaptchaResetSignal((n) => n + 1);
      setGeocodeResults([]);
      setGeocodeError(null);
      
      // Small UX: return home after a brief beat
      setTimeout(() => navigate('/'), 400);
    } catch (err) {
      console.error('Failed to submit business:', err);
      setSubmitError(t('errors.network'));
      setCaptchaToken('');
      setCaptchaResetSignal((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForAnother() {
    setSubmitSuccess(null);
    setSubmitError(null);
  }

  if (submitSuccess) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1rem' }}>
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'grid',
            gap: '0.75rem',
            justifyItems: 'center',
            textAlign: 'center',
            padding: '2.5rem 1.5rem',
            border: '1px solid #4caf50',
            borderRadius: 14,
            marginTop: '1.5rem',
          }}
        >
          <h2 style={{ margin: 0 }}>{t('create.received')}</h2>
          <p style={{ margin: 0, maxWidth: 460, opacity: 0.85 }}>{submitSuccess}</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{ padding: '0.65rem 1.1rem', borderRadius: 10, border: '1px solid #444', fontWeight: 700, cursor: 'pointer' }}
            >
              {t('create.backToMap')}
            </button>
            <button
              type="button"
              onClick={resetForAnother}
              style={{ padding: '0.65rem 1.1rem', borderRadius: 10, border: '1px solid #444', fontWeight: 600, cursor: 'pointer' }}
            >
              {t('create.submitAnother')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '1rem' }}>
      <h2 style={{ margin: '0 0 0.25rem 0' }}>{t('create.title')}</h2>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        {t('create.intro')}
      </p>

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

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>{t('create.nameEnglish')}{nameFr.trim() ? '' : ' *'}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required={!nameFr.trim()}
            placeholder={t('create.namePlaceholder')}
            style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid #444' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>{t('create.nameFrench')}{name.trim() ? '' : ' *'}</span>
          <input
            value={nameFr}
            onChange={(e) => setNameFr(e.target.value)}
            required={!name.trim()}
            placeholder={t('create.namePlaceholder')}
            style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid #444' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>{t('create.email')}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder={t('create.emailPlaceholder')}
            style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid #444' }}
          />
          <span style={{ fontSize: 13, opacity: 0.7 }}>
            {t('create.emailHelp')}
          </span>
        </label>

        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>{t('create.categories')}</span>
          <CategoryCheckboxes
            categories={categories}
            loading={loadingCategories}
            selected={categoryIds}
            onChange={setCategoryIds}
          />
        </div>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>{t('create.descriptionEnglish')}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('create.optionalDescription')}
            rows={4}
            style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid #444' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>{t('create.descriptionFrench')}</span>
          <textarea
            value={descriptionFr}
            onChange={(e) => setDescriptionFr(e.target.value)}
            placeholder={t('create.optionalDescription')}
            rows={4}
            style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid #444' }}
          />
        </label>

        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>{t('create.address')}</span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'start' }}>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('create.optionalAddress')}
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
              {geocoding ? t('create.geocoding') : t('create.geocode')}
            </button>
          </div>

          {geocodeError && (
            <div style={{ color: '#ff9a9a', fontSize: 13 }}>{geocodeError}</div>
          )}

          {geocodeResults.length > 0 && (
            <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.35rem' }}>
              <div style={{ fontWeight: 700, fontSize: 13, opacity: 0.8 }}>{t('create.chooseAddress')}</div>
              <div
                style={{
                  display: 'grid',
                  gap: '0.45rem',
                  padding: '0.5rem',
                  border: '1px solid #444',
                  borderRadius: 10,
                  background: '#171717',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
                }}
              >
                {geocodeResults.map((result) => (
                  <button
                    key={`${result.displayName}-${result.latitude}-${result.longitude}`}
                    type="button"
                    onClick={() => handleSelectGeocodeResult(result)}
                    style={{
                      textAlign: 'left',
                      padding: '0.7rem 0.8rem',
                      borderRadius: 8,
                      border: '1px solid #4a4a4a',
                      background: '#202020',
                      color: 'inherit',
                      cursor: 'pointer',
                      lineHeight: 1.5,
                      transition: 'border-color 0.15s ease, background 0.15s ease',
                    }}
                  >
                    {result.displayName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontWeight: 600 }}>{t('create.latitude')}</span>
            <input
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="e.g. 45.421"
              inputMode="decimal"
              style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid #444' }}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontWeight: 600 }}>{t('create.longitude')}</span>
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
          {t('create.coordinatesHelp')}
        </div>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>{t('create.websiteUrl')}</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.org"
            style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid #444' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>{t('create.imageUrl')}</span>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.org/photo.jpg"
            style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid #444' }}
          />
          <span style={{ fontSize: 13, opacity: 0.7 }}>
            {t('create.imageHelp')}
          </span>
        </label>

        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600 }}>{t('create.verifyHuman')}</span>
          <TurnstileWidget onToken={setCaptchaToken} resetSignal={captchaResetSignal} />
        </div>

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
            {submitting ? t('create.submitting') : t('create.submit')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{ padding: '0.65rem 0.9rem', borderRadius: 10, border: '1px solid #444', fontWeight: 600 }}
          >
            {t('create.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
