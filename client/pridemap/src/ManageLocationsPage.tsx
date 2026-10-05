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

type Submission = {
  id: number;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  url: string | null;
  submitter_email: string;
  category_ids: number[];
  status: string;
  created_at: string;
};

interface ManageLocationsPageProps {
  /** JWT token to attach to mutating API requests. */
  authToken: string;
  /** Called when the server returns 401, so App can clear the token. */
  onAuthError: () => void;
}

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

export default function ManageLocationsPage({ authToken, onAuthError }: ManageLocationsPageProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Top-level view: edit the live map ('locations') or review the pending queue.
  const [view, setView] = useState<'locations' | 'submissions'>('locations');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  // Tracks which submission ids currently have an approve/reject request in flight.
  const [busySubmissionId, setBusySubmissionId] = useState<number | null>(null);
  // Inline editing of a pending submission before approval.
  const [editingSubmissionId, setEditingSubmissionId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: '', email: '', description: '', address: '',
    latitude: '', longitude: '', url: '', categoryIds: [] as number[],
  });
  const [savingSubmission, setSavingSubmission] = useState(false);

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

  // Load the pending submissions queue (admin-only endpoint).
  useEffect(() => {
    let cancelled = false;
    setSubmissionsError(null);
    fetch('/api/submissions?status=pending', {
      headers: { 'Authorization': `Bearer ${authToken}` },
    })
      .then(async (res) => {
        if (res.status === 401) { onAuthError(); return []; }
        if (!res.ok) throw new Error(`Failed to load submissions (${res.status})`);
        return res.json();
      })
      .then((rows: Submission[]) => {
        if (!cancelled) setSubmissions(rows ?? []);
      })
      .catch((err) => {
        if (!cancelled) setSubmissionsError(err instanceof Error ? err.message : 'Failed to load submissions');
      });
    return () => { cancelled = true; };
  }, [authToken, onAuthError]);

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach(c => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const filteredLocations = useMemo(() => {
    const q = search.toLowerCase();
    return locations.filter(l => l.name.toLowerCase().includes(q));
  }, [locations, search]);

  async function handleApprove(sub: Submission) {
    setBusySubmissionId(sub.id);
    setSubmissionsError(null);
    try {
      const res = await fetch(`/api/submissions/${sub.id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) { onAuthError(); return; }
      if (!res.ok) {
        setSubmissionsError(json?.error ?? `Failed to approve (${res.status})`);
        return;
      }
      // Reflect the new live location without a refetch.
      const newLoc: Location = {
        id: json.locationId,
        name: sub.name,
        description: sub.description,
        address: sub.address,
        latitude: sub.latitude,
        longitude: sub.longitude,
        url: sub.url,
        category_ids: sub.category_ids,
      };
      setLocations(prev => [...prev, newLoc].sort((a, b) => a.name.localeCompare(b.name)));
      setSubmissions(prev => prev.filter(s => s.id !== sub.id));
    } catch (err) {
      setSubmissionsError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setBusySubmissionId(null);
    }
  }

  async function handleReject(sub: Submission) {
    setBusySubmissionId(sub.id);
    setSubmissionsError(null);
    try {
      const res = await fetch(`/api/submissions/${sub.id}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) { onAuthError(); return; }
      if (!res.ok) {
        setSubmissionsError(json?.error ?? `Failed to reject (${res.status})`);
        return;
      }
      setSubmissions(prev => prev.filter(s => s.id !== sub.id));
    } catch (err) {
      setSubmissionsError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setBusySubmissionId(null);
    }
  }

  function startEditSubmission(sub: Submission) {
    setSubmissionsError(null);
    setEditingSubmissionId(sub.id);
    setEditDraft({
      name: sub.name,
      email: sub.submitter_email,
      description: sub.description ?? '',
      address: sub.address ?? '',
      latitude: sub.latitude != null ? String(sub.latitude) : '',
      longitude: sub.longitude != null ? String(sub.longitude) : '',
      url: sub.url ?? '',
      categoryIds: sub.category_ids,
    });
  }

  function cancelEditSubmission() {
    setEditingSubmissionId(null);
  }

  async function saveSubmissionEdit(sub: Submission) {
    setSubmissionsError(null);

    const lat = toNullableNumber(editDraft.latitude);
    const lng = toNullableNumber(editDraft.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setSubmissionsError('Latitude/Longitude must be valid numbers (or left blank).');
      return;
    }

    const payload = {
      name: editDraft.name.trim(),
      submitter_email: editDraft.email.trim(),
      description: toNullIfEmpty(editDraft.description),
      address: toNullIfEmpty(editDraft.address),
      latitude: lat,
      longitude: lng,
      url: toNullIfEmpty(editDraft.url),
      category_ids: editDraft.categoryIds,
    };

    setSavingSubmission(true);
    try {
      const res = await fetch(`/api/submissions/${sub.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) { onAuthError(); return; }
      if (!res.ok) {
        setSubmissionsError(json?.error ?? `Failed to save (${res.status})`);
        return;
      }
      // Merge the saved values back into the list.
      setSubmissions(prev => prev.map(s => (s.id === sub.id ? { ...s, ...json } : s)));
      setEditingSubmissionId(null);
    } catch (err) {
      setSubmissionsError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingSubmission(false);
    }
  }

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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) { onAuthError(); return; }
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) { onAuthError(); return; }
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
      const res = await fetch(`/api/locations/${selectedId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) { onAuthError(); return; }
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

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.5rem 1rem',
    borderRadius: 8,
    border: '1px solid #444',
    background: active ? '#2a2a2a' : 'transparent',
    color: 'inherit',
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
  });

  const submissionsPanel = (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.5rem' }}>
      <div style={{ maxWidth: 760, width: '100%', margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 1rem 0' }}>Pending Submissions</h2>
        {submissionsError && (
          <div style={{ padding: '0.75rem', border: '1px solid #ff5a5a', borderRadius: 8, marginBottom: '0.75rem', color: '#ff5a5a' }}>
            {submissionsError}
          </div>
        )}
        {submissions.length === 0 ? (
          <div style={{ opacity: 0.6, marginTop: '2rem', textAlign: 'center' }}>
            No pending submissions.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {submissions.map(sub => {
              const busy = busySubmissionId === sub.id;
              const catNames = sub.category_ids
                .map(id => categoryNameById.get(id))
                .filter((n): n is string => Boolean(n));
              const hasPin = sub.latitude != null && sub.longitude != null;
              const isEditing = editingSubmissionId === sub.id;
              return (
                <div key={sub.id} style={{ border: '1px solid #333', borderRadius: 10, padding: '1rem', display: 'grid', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0 }}>{isEditing ? 'Editing submission' : sub.name}</h3>
                    <span style={{ fontSize: 12, opacity: 0.55 }}>
                      {new Date(sub.created_at).toLocaleString()}
                    </span>
                  </div>

                  {isEditing ? (
                    <div style={{ display: 'grid', gap: '0.6rem' }}>
                      <label style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>Name *</span>
                        <input value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} style={inputStyle} />
                      </label>
                      <label style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>Submitter email *</span>
                        <input value={editDraft.email} onChange={e => setEditDraft(d => ({ ...d, email: e.target.value }))} style={inputStyle} />
                      </label>
                      <div style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>Categories</span>
                        <CategoryCheckboxes
                          categories={categories}
                          loading={false}
                          selected={editDraft.categoryIds}
                          onChange={ids => setEditDraft(d => ({ ...d, categoryIds: ids }))}
                        />
                      </div>
                      <label style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>Description</span>
                        <textarea value={editDraft.description} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))} rows={4} style={inputStyle} />
                      </label>
                      <label style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>Address</span>
                        <input value={editDraft.address} onChange={e => setEditDraft(d => ({ ...d, address: e.target.value }))} style={inputStyle} />
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <label style={labelStyle}>
                          <span style={{ fontWeight: 600 }}>Latitude</span>
                          <input value={editDraft.latitude} onChange={e => setEditDraft(d => ({ ...d, latitude: e.target.value }))} placeholder="e.g. 45.421" inputMode="decimal" style={inputStyle} />
                        </label>
                        <label style={labelStyle}>
                          <span style={{ fontWeight: 600 }}>Longitude</span>
                          <input value={editDraft.longitude} onChange={e => setEditDraft(d => ({ ...d, longitude: e.target.value }))} placeholder="e.g. -75.690" inputMode="decimal" style={inputStyle} />
                        </label>
                      </div>
                      <label style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>Website URL</span>
                        <input value={editDraft.url} onChange={e => setEditDraft(d => ({ ...d, url: e.target.value }))} placeholder="https://example.org" style={inputStyle} />
                      </label>

                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                        <button
                          type="button"
                          onClick={() => saveSubmissionEdit(sub)}
                          disabled={savingSubmission || editDraft.name.trim().length === 0}
                          style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #4caf50', color: '#4caf50', fontWeight: 700, cursor: savingSubmission ? 'not-allowed' : 'pointer', background: 'transparent' }}
                        >
                          {savingSubmission ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditSubmission}
                          disabled={savingSubmission}
                          style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #444', fontWeight: 600, cursor: 'pointer', background: 'transparent', color: 'inherit' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 13 }}>
                        <strong>Submitted by:</strong>{' '}
                        <a href={`mailto:${sub.submitter_email}`} style={{ color: 'inherit' }}>{sub.submitter_email}</a>
                      </div>

                      {catNames.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {catNames.map(n => (
                            <span key={n} style={{ fontSize: 12, padding: '0.15rem 0.5rem', border: '1px solid #444', borderRadius: 999 }}>{n}</span>
                          ))}
                        </div>
                      )}

                      {sub.description && (
                        <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', opacity: 0.9 }}>{sub.description}</div>
                      )}
                      {sub.address && (
                        <div style={{ fontSize: 13 }}><strong>Address:</strong> {sub.address}</div>
                      )}
                      <div style={{ fontSize: 13 }}>
                        <strong>Coordinates:</strong>{' '}
                        {hasPin ? `${sub.latitude}, ${sub.longitude}` : <span style={{ opacity: 0.6 }}>none (won't show as a pin)</span>}
                      </div>
                      {sub.url && (
                        <div style={{ fontSize: 13 }}>
                          <strong>Website:</strong>{' '}
                          <a href={sub.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{sub.url}</a>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => handleApprove(sub)}
                          disabled={busy}
                          style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #4caf50', color: '#4caf50', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', background: 'transparent' }}
                        >
                          {busy ? 'Working…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditSubmission(sub)}
                          disabled={busy}
                          style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #555', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', background: 'transparent', color: 'inherit' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(sub)}
                          disabled={busy}
                          style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #ff5a5a', color: '#ff5a5a', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', background: 'transparent' }}
                        >
                          {busy ? 'Working…' : 'Reject'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 72px)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid #333' }}>
        <button type="button" onClick={() => setView('locations')} style={tabBtnStyle(view === 'locations')}>
          Locations
        </button>
        <button type="button" onClick={() => setView('submissions')} style={tabBtnStyle(view === 'submissions')}>
          Pending Submissions{submissions.length > 0 ? ` (${submissions.length})` : ''}
        </button>
      </div>

      {view === 'submissions' ? submissionsPanel : (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>

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
      )}
    </div>
  );
}
