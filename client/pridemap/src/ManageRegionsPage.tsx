import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthUser } from './auth';
import type { Region } from './regions';
import i18nInstance from './i18n';
import { localizedApiError } from './localizedApiError';

type RegionalUser = { id: number; username: string; email: string | null };

export default function ManageRegionsPage({ authToken, user, onAuthError }: {
  authToken: string;
  user: AuthUser;
  onAuthError: () => void;
}) {
  const { t } = useTranslation();
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [regionalUsers, setRegionalUsers] = useState<RegionalUser[]>([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminSuggestions, setAdminSuggestions] = useState<RegionalUser[]>([]);
  const [searchingAdmins, setSearchingAdmins] = useState(false);
  const [newName, setNewName] = useState('');
  const [regionName, setRegionName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headers = useMemo(() => ({ Authorization: `Bearer ${authToken}` }), [authToken]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/regions/manage', { headers })
      .then(async response => {
        if (response.status === 401) { onAuthError(); return []; }
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<Region[]>;
      })
      .then(list => {
        if (cancelled || !list) return;
        setRegions(list);
        setSelectedRegionId(list[0]?.id ?? null);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Failed to load regions:', err);
        setError(i18nInstance.t('errors.network'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authToken, headers, onAuthError]);

  useEffect(() => {
    if (selectedRegionId === null) {
      setRegionalUsers([]);
      setRegionName('');
      setAdminSuggestions([]);
      return;
    }
    let cancelled = false;
    setRegionalUsers([]);
    setRegionName(regions.find(region => region.id === selectedRegionId)?.name ?? '');
    fetch(`/api/regions/${selectedRegionId}/admins`, { headers, cache: 'no-store' })
      .then(async response => {
        if (response.status === 401) { onAuthError(); return []; }
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<RegionalUser[]>;
      })
      .then(rows => { if (!cancelled && rows) setRegionalUsers(rows); })
      .catch(err => {
        if (cancelled) return;
        console.error('Failed to load regional administrators:', err);
        setError(i18nInstance.t('errors.network'));
      });
    return () => { cancelled = true; };
  }, [authToken, headers, onAuthError, regions, selectedRegionId]);

  useEffect(() => {
    const query = adminSearch.trim();
    if (selectedRegionId === null || query.length < 2) {
      setAdminSuggestions([]);
      setSearchingAdmins(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setSearchingAdmins(true);
      fetch(`/api/regions/${selectedRegionId}/admins/search?q=${encodeURIComponent(query)}`, { headers })
        .then(async response => {
          if (response.status === 401) { onAuthError(); return []; }
          if (!response.ok) throw new Error(String(response.status));
          return response.json() as Promise<RegionalUser[]>;
        })
        .then(rows => {
          if (!cancelled && rows) setAdminSuggestions(rows);
        })
        .catch(err => {
          if (cancelled) return;
          console.error('Failed to search regional administrators:', err);
          setError(i18nInstance.t('errors.network'));
        })
        .finally(() => { if (!cancelled) setSearchingAdmins(false); });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [adminSearch, headers, onAuthError, selectedRegionId]);

  async function createRegion(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/regions', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      if (response.status === 401) { onAuthError(); return; }
      if (!response.ok) throw new Error(response.status === 409 ? t('regions.nameTaken') : t('errors.network'));
      const created: Region = await response.json();
      setRegions(current => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedRegionId(created.id);
      setNewName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.network'));
    } finally { setBusy(false); }
  }

  async function saveName() {
    if (selectedRegionId === null) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/regions/${selectedRegionId}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regionName }),
      });
      if (response.status === 401) { onAuthError(); return; }
      if (!response.ok) throw new Error(response.status === 409 ? t('regions.nameTaken') : t('errors.network'));
      const updated: Region = await response.json();
      setRegions(current => current.map(region => region.id === updated.id ? updated : region));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.network'));
    } finally { setBusy(false); }
  }

  async function deleteRegion() {
    const region = regions.find(item => item.id === selectedRegionId);
    if (!region || !window.confirm(t('regions.deleteConfirm', { name: region.name }))) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/regions/${region.id}`, { method: 'DELETE', headers });
      if (response.status === 401) { onAuthError(); return; }
      if (!response.ok) throw new Error(t('errors.network'));
      const remaining = regions.filter(item => item.id !== region.id);
      setRegions(remaining);
      setSelectedRegionId(remaining[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.network'));
    } finally { setBusy(false); }
  }

  async function setRegionalAdmin(regionalUser: RegionalUser, isAdmin: boolean) {
    if (selectedRegionId === null) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/regions/${selectedRegionId}/admins/${regionalUser.id}`, {
        method: isAdmin ? 'POST' : 'DELETE',
        headers,
      });
      if (response.status === 401) { onAuthError(); return; }
      if (!response.ok) {
        let code: string | undefined;
        try {
          const body = await response.json() as { code?: string };
          code = body.code;
        } catch {
          // Non-JSON proxy and routing errors are reported by HTTP status.
        }
        throw new Error(localizedApiError(code, response.status));
      }
      setRegionalUsers(current => isAdmin
        ? [...current, regionalUser].sort((a, b) => a.username.localeCompare(b.username))
        : current.filter(item => item.id !== regionalUser.id));
      if (isAdmin) setAdminSearch('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.network'));
    } finally { setBusy(false); }
  }

  if (loading) return <div style={{ padding: '2rem' }}>{t('admin.loading')}</div>;

  return (
    <main className="manage-regions">
      <h1>{t('regions.manageTitle')}</h1>
      {error && <div role="alert" className="manage-regions__error">{error}</div>}
      {user.isAdmin && (
        <section className="manage-regions__card">
          <h2>{t('regions.create')}</h2>
          <form onSubmit={createRegion} className="manage-regions__new">
            <label>
              <span>{t('regions.newRegion')}</span>
              <input value={newName} onChange={event => setNewName(event.target.value)} required />
            </label>
            <button type="submit" disabled={busy}>{t('regions.create')}</button>
          </form>
        </section>
      )}
      {regions.length === 0 ? <p>{t('regions.noRegions')}</p> : (
        <section className="manage-regions__card">
          <h2>{t('regions.manageExisting')}</h2>
          <label className="manage-regions__select">
            <span>{t('regions.selectManage')}</span>
            <select value={selectedRegionId ?? ''} onChange={event => setSelectedRegionId(Number(event.target.value))}>
              {regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
            </select>
          </label>
          {selectedRegionId !== null && (
            <section className="manage-regions__section">
              <h2>{t('regions.details')}</h2>
              <div className="manage-regions__rename">
                <label>
                  <span>{t('regions.regionName')}</span>
                  <input value={regionName} onChange={event => setRegionName(event.target.value)} />
                </label>
                <button type="button" disabled={busy || !regionName.trim()} onClick={saveName}>{t('admin.saveChanges')}</button>
                <button type="button" className="manage-regions__delete" disabled={busy} onClick={deleteRegion}>{t('regions.delete')}</button>
              </div>
              <h2>{t('regions.regionalAdmins')}</h2>
              <p>{t('regions.adminHelp')}</p>
              <div className="manage-regions__admin-search">
                <label htmlFor="regional-admin-search">{t('regions.searchAdmin')}</label>
                <input
                  id="regional-admin-search"
                  type="search"
                  value={adminSearch}
                  onChange={event => setAdminSearch(event.target.value)}
                  placeholder={t('regions.searchAdminPlaceholder')}
                  autoComplete="off"
                />
                {searchingAdmins && <p>{t('admin.loading')}</p>}
                {!searchingAdmins && adminSearch.trim().length >= 2 && adminSuggestions.length === 0 && (
                  <p>{t('regions.noMatchingUsers')}</p>
                )}
                {adminSuggestions.length > 0 && (
                  <ul className="manage-regions__suggestions">
                    {adminSuggestions.map(suggestion => (
                      <li key={suggestion.id}>
                        <span>{suggestion.username}{suggestion.email ? ` · ${suggestion.email}` : ''}</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setRegionalAdmin(suggestion, true)}
                        >
                          {t('regions.addAdmin')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {regionalUsers.length === 0 ? <p>{t('regions.noAdmins')}</p> : regionalUsers.map(regionalUser => (
                <label key={regionalUser.id} className="manage-regions__user">
                  <span>{regionalUser.username}{regionalUser.email ? ` · ${regionalUser.email}` : ''}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setRegionalAdmin(regionalUser, false)}
                  >
                    {t('regions.removeAdmin')}
                  </button>
                </label>
              ))}
            </section>
          )}
        </section>
      )}
    </main>
  );
}
