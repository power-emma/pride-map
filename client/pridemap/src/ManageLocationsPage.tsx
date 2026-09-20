import { useEffect, useMemo, useState } from 'react';
import CategoryCheckboxes from './components/CategoryCheckboxes';
import ImageUploadControl from './components/ImageUploadControl';
import { CITY_NAME } from './config';

type Category = { id: number; name: string };

type Location = {
  id: number;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  url: string | null;
  image_url: string | null;
  has_image: boolean;
  category_ids: number[];
};

type EventItem = {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  location_id: number | null;
  location_name?: string | null;
  location_image_url?: string | null;
  location_has_image?: boolean;
  city: string;
  url: string | null;
  image_url: string | null;
  has_image: boolean;
  created_at: string;
};

type Submission = {
  id: number;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  url: string | null;
  image_url: string | null;
  has_image: boolean;
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

  // Top-level view: edit the live map ('locations'), review the pending queue,
  // or manage the "Happening in <city>" events cards.
  const [view, setView] = useState<'locations' | 'submissions' | 'events'>('locations');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  // Tracks which submission ids currently have an approve/reject request in flight.
  const [busySubmissionId, setBusySubmissionId] = useState<number | null>(null);
  // Inline editing of a pending submission before approval.
  const [editingSubmissionId, setEditingSubmissionId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: '', email: '', description: '', address: '',
    latitude: '', longitude: '', url: '', imageUrl: '', categoryIds: [] as number[],
  });
  const [savingSubmission, setSavingSubmission] = useState(false);

  // Events management ("Happening in <city>" cards on the main map).
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventMode, setEventMode] = useState<'idle' | 'edit' | 'create'>('idle');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventLocationId, setEventLocationId] = useState<number | null>(null);
  const [eventCity, setEventCity] = useState(CITY_NAME);
  const [eventUrl, setEventUrl] = useState('');
  const [eventImageUrl, setEventImageUrl] = useState('');
  const [eventHasImage, setEventHasImage] = useState(false);
  const [eventSaving, setEventSaving] = useState(false);
  const [eventSaveError, setEventSaveError] = useState<string | null>(null);
  const [eventSaveSuccess, setEventSaveSuccess] = useState<string | null>(null);
  const [eventDeleting, setEventDeleting] = useState(false);
  const [confirmEventDelete, setConfirmEventDelete] = useState(false);

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
  const [imageUrl, setImageUrl] = useState('');
  const [hasImage, setHasImage] = useState(false);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);

  const [geocodeResults, setGeocodeResults] = useState<Array<{ displayName: string; latitude: string; longitude: string }>>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

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

  // Load all events (admin-only endpoint; includes past events for management).
  useEffect(() => {
    let cancelled = false;
    setEventsError(null);
    fetch('/api/events/all', {
      headers: { 'Authorization': `Bearer ${authToken}` },
    })
      .then(async (res) => {
        if (res.status === 401) { onAuthError(); return []; }
        if (!res.ok) throw new Error(`Failed to load events (${res.status})`);
        return res.json();
      })
      .then((rows: EventItem[]) => {
        if (!cancelled) setEvents(rows ?? []);
      })
      .catch((err) => {
        if (!cancelled) setEventsError(err instanceof Error ? err.message : 'Failed to load events');
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
        image_url: sub.image_url,
        has_image: sub.has_image,
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
      imageUrl: sub.image_url ?? '',
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
      image_url: toNullIfEmpty(editDraft.imageUrl),
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
    setImageUrl('');
    setHasImage(false);
    setCategoryIds([]);
    setGeocodeResults([]);
    setGeocodeError(null);
    setSaveError(null);
    setSaveSuccess(null);
    setConfirmDelete(false);
  }

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
    setImageUrl(loc.image_url ?? '');
    setHasImage(loc.has_image);
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
      image_url: toNullIfEmpty(imageUrl),
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
      image_url: toNullIfEmpty(imageUrl),
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

      const newLoc: Location = { id: json.id, ...payload, has_image: false, category_ids: payload.category_ids };
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

  function clearEventForm() {
    setEventTitle('');
    setEventDescription('');
    setEventDate('');
    setEventTime('');
    setEventLocation('');
    setEventLocationId(null);
    setEventCity(CITY_NAME);
    setEventUrl('');
    setEventImageUrl('');
    setEventHasImage(false);
    setEventSaveError(null);
    setEventSaveSuccess(null);
    setConfirmEventDelete(false);
  }

  function selectEvent(ev: EventItem) {
    clearEventForm();
    setSelectedEventId(ev.id);
    setEventMode('edit');
    setEventTitle(ev.title);
    setEventDescription(ev.description ?? '');
    setEventDate(ev.event_date.slice(0, 10));
    setEventTime(ev.event_time ?? '');
    setEventLocation(ev.location ?? '');
    setEventLocationId(ev.location_id ?? null);
    setEventCity(ev.city);
    setEventUrl(ev.url ?? '');
    setEventImageUrl(ev.image_url ?? '');
    setEventHasImage(ev.has_image);
  }

  function openCreateEvent() {
    clearEventForm();
    setSelectedEventId(null);
    setEventMode('create');
  }

  function eventPayload() {
    return {
      title: eventTitle.trim(),
      description: toNullIfEmpty(eventDescription),
      event_date: eventDate,
      event_time: toNullIfEmpty(eventTime),
      location: toNullIfEmpty(eventLocation),
      location_id: eventLocationId,
      city: eventCity.trim() || CITY_NAME,
      url: toNullIfEmpty(eventUrl),
      image_url: toNullIfEmpty(eventImageUrl),
    };
  }

  async function handleEventCreate(e: React.FormEvent) {
    e.preventDefault();
    setEventSaveError(null);
    setEventSaveSuccess(null);

    setEventSaving(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(eventPayload()),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) { onAuthError(); return; }
      if (!res.ok) {
        setEventSaveError(json?.error ?? `Failed to create (${res.status})`);
        return;
      }

      setEvents(prev => [...prev, { ...json, has_image: false }].sort((a, b) => a.event_date.localeCompare(b.event_date)));
      setEventSaveSuccess('Event created.');
      setSelectedEventId(json.id);
      setEventMode('edit');
    } catch (err) {
      setEventSaveError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setEventSaving(false);
    }
  }

  async function handleEventSave(e: React.FormEvent) {
    e.preventDefault();
    if (selectedEventId == null) return;
    setEventSaveError(null);
    setEventSaveSuccess(null);

    setEventSaving(true);
    try {
      const res = await fetch(`/api/events/${selectedEventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(eventPayload()),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) { onAuthError(); return; }
      if (!res.ok) {
        setEventSaveError(json?.error ?? `Failed to save (${res.status})`);
        return;
      }

      // The PUT response doesn't carry the joined business name/image — recompute
      // them from the already-loaded locations list so the admin UI stays correct
      // even if location_id just changed.
      const linkedLoc = json.location_id != null ? locations.find(l => l.id === json.location_id) : null;
      setEvents(prev => prev.map(ev => (ev.id === selectedEventId ? {
        ...ev,
        ...json,
        location_name: linkedLoc?.name ?? null,
        location_image_url: linkedLoc?.image_url ?? null,
        location_has_image: linkedLoc?.has_image ?? false,
      } : ev)));
      setEventSaveSuccess('Saved successfully.');
    } catch (err) {
      setEventSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setEventSaving(false);
    }
  }

  async function handleEventDelete() {
    if (selectedEventId == null) return;
    if (!confirmEventDelete) {
      setConfirmEventDelete(true);
      return;
    }
    setEventDeleting(true);
    setEventSaveError(null);
    try {
      const res = await fetch(`/api/events/${selectedEventId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) { onAuthError(); return; }
      if (!res.ok) {
        setEventSaveError(json?.error ?? `Failed to delete (${res.status})`);
        setEventDeleting(false);
        return;
      }
      setEvents(prev => prev.filter(ev => ev.id !== selectedEventId));
      setSelectedEventId(null);
      setEventMode('idle');
      setConfirmEventDelete(false);
    } catch (err) {
      setEventSaveError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setEventDeleting(false);
    }
  }

  const selectedEvent = events.find(ev => ev.id === selectedEventId) ?? null;

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

      <div style={labelStyle}>
        <span style={{ fontWeight: 600 }}>Address</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'start' }}>
          <input value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} />
          <button
            type="button"
            onClick={handleGeocode}
            disabled={geocoding || address.trim().length === 0}
            style={{
              padding: '0.55rem 0.8rem',
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
          <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.25rem' }}>
            {geocodeResults.map((result) => (
              <button
                key={`${result.displayName}-${result.latitude}-${result.longitude}`}
                type="button"
                onClick={() => handleSelectGeocodeResult(result)}
                style={{
                  textAlign: 'left',
                  padding: '0.5rem 0.7rem',
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

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>Image URL</span>
        <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.org/photo.jpg" style={inputStyle} />
      </label>
      {!hasImage && imageUrl.trim() && (
        <img src={imageUrl} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8 }} />
      )}

      <div style={labelStyle}>
        <span style={{ fontWeight: 600 }}>Upload Image</span>
        <ImageUploadControl
          authToken={authToken}
          uploadUrl={!isCreate && selectedId != null ? `/api/locations/${selectedId}/image` : null}
          hasImage={hasImage}
          onChange={setHasImage}
        />
        <span style={{ fontSize: 13, opacity: 0.7 }}>An uploaded photo takes priority over the Image URL above.</span>
      </div>

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

  const eventForm = (isCreate: boolean) => (
    <form onSubmit={isCreate ? handleEventCreate : handleEventSave} style={{ display: 'grid', gap: '0.75rem' }}>
      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>Title *</span>
        <input value={eventTitle} onChange={e => setEventTitle(e.target.value)} required style={inputStyle} />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <label style={labelStyle}>
          <span style={{ fontWeight: 600 }}>Date *</span>
          <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required style={inputStyle} />
        </label>
        <label style={labelStyle}>
          <span style={{ fontWeight: 600 }}>Time</span>
          <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} style={inputStyle} />
        </label>
      </div>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>Description</span>
        <textarea value={eventDescription} onChange={e => setEventDescription(e.target.value)} rows={4} style={inputStyle} />
      </label>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>Location / venue</span>
        <input value={eventLocation} onChange={e => setEventLocation(e.target.value)} placeholder="e.g. Ottawa City Hall" style={inputStyle} />
      </label>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>Linked business (optional)</span>
        <select
          value={eventLocationId ?? ''}
          onChange={e => setEventLocationId(e.target.value ? Number(e.target.value) : null)}
          style={inputStyle}
        >
          <option value="">None</option>
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
      </label>
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        If this event has no image of its own, the linked business's image is shown instead.
      </div>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>City *</span>
        <input value={eventCity} onChange={e => setEventCity(e.target.value)} required style={inputStyle} />
      </label>
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        Must match "{CITY_NAME}" to show up in the "Happening in {CITY_NAME}" cards on the map.
      </div>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>Website URL</span>
        <input value={eventUrl} onChange={e => setEventUrl(e.target.value)} placeholder="https://example.org" style={inputStyle} />
      </label>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>Image URL</span>
        <input value={eventImageUrl} onChange={e => setEventImageUrl(e.target.value)} placeholder="https://example.org/photo.jpg" style={inputStyle} />
      </label>

      <div style={labelStyle}>
        <span style={{ fontWeight: 600 }}>Upload Image</span>
        <ImageUploadControl
          authToken={authToken}
          uploadUrl={!isCreate && selectedEventId != null ? `/api/events/${selectedEventId}/image` : null}
          hasImage={eventHasImage}
          onChange={setEventHasImage}
        />
      </div>

      {!eventHasImage && (() => {
        const linkedLoc = eventLocationId != null ? locations.find(l => l.id === eventLocationId) : null;
        const linkedImage = linkedLoc?.has_image ? `/api/locations/${linkedLoc.id}/image` : (linkedLoc?.image_url ?? null);
        const preview = eventImageUrl.trim() || linkedImage;
        if (!preview) return null;
        return (
          <div style={{ display: 'grid', gap: '0.3rem' }}>
            <img src={preview} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8 }} />
            {!eventImageUrl.trim() && (
              <span style={{ fontSize: 12, opacity: 0.6 }}>Using the linked business's image (no image set for this event).</span>
            )}
          </div>
        );
      })()}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={eventSaving || eventTitle.trim().length === 0 || eventDate.trim().length === 0}
          style={{ padding: '0.6rem 1.1rem', borderRadius: 8, border: '1px solid #444', fontWeight: 700, cursor: eventSaving ? 'not-allowed' : 'pointer' }}
        >
          {eventSaving ? (isCreate ? 'Creating…' : 'Saving…') : (isCreate ? 'Create Event' : 'Save Changes')}
        </button>

        {!isCreate && (
          <button
            type="button"
            onClick={handleEventDelete}
            disabled={eventDeleting}
            style={{
              padding: '0.6rem 1.1rem',
              borderRadius: 8,
              border: `1px solid ${confirmEventDelete ? '#ff5a5a' : '#444'}`,
              fontWeight: 700,
              color: confirmEventDelete ? '#ff5a5a' : 'inherit',
              cursor: eventDeleting ? 'not-allowed' : 'pointer',
            }}
          >
            {eventDeleting ? 'Deleting…' : confirmEventDelete ? 'Confirm Delete' : 'Delete'}
          </button>
        )}

        {confirmEventDelete && (
          <button
            type="button"
            onClick={() => setConfirmEventDelete(false)}
            style={{ padding: '0.6rem 0.9rem', borderRadius: 8, border: '1px solid #444', cursor: 'pointer' }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );

  const eventsPanel = (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem', borderBottom: '1px solid #333' }}>
          <button
            onClick={openCreateEvent}
            style={{
              padding: '0.55rem 0.75rem',
              borderRadius: 8,
              border: '1px solid #555',
              fontWeight: 700,
              cursor: 'pointer',
              background: eventMode === 'create' ? '#2a2a2a' : 'transparent',
              color: 'inherit',
              textAlign: 'left',
              width: '100%',
            }}
          >
            + Add Event
          </button>
        </div>
        {eventsError && (
          <div style={{ padding: '0.75rem', color: '#ff5a5a', fontSize: 13 }}>{eventsError}</div>
        )}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {events.length === 0 && (
            <div style={{ padding: '1rem', opacity: 0.6 }}>No events yet.</div>
          )}
          {events.map(ev => (
            <button
              key={ev.id}
              onClick={() => selectEvent(ev)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.65rem 0.75rem',
                background: ev.id === selectedEventId && eventMode === 'edit' ? '#2a2a2a' : 'transparent',
                border: 'none',
                borderBottom: '1px solid #222',
                color: 'inherit',
                cursor: 'pointer',
                fontWeight: ev.id === selectedEventId && eventMode === 'edit' ? 700 : 400,
              }}
            >
              <div style={{ fontSize: 14 }}>{ev.title}</div>
              <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>
                {ev.event_date.slice(0, 10)}{ev.event_time ? ` · ${ev.event_time.slice(0, 5)}` : ''} — {ev.city}
              </div>
            </button>
          ))}
        </div>
        <div style={{ padding: '0.6rem', borderTop: '1px solid #333', fontSize: 12, opacity: 0.5 }}>
          {events.length} event{events.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div style={{ overflowY: 'auto', padding: '1.5rem' }}>
        <div style={{ maxWidth: 640, width: '100%', margin: '0 auto' }}>
          {eventMode === 'idle' && (
            <div style={{ opacity: 0.5, marginTop: '2rem', textAlign: 'center' }}>
              Select an event to edit it, or click <strong>+ Add Event</strong>.
            </div>
          )}

          {eventMode === 'create' && (
            <>
              <h2 style={{ margin: '0 0 1rem 0' }}>Add an Event</h2>
              {eventSaveError && <div style={{ padding: '0.75rem', border: '1px solid #ff5a5a', borderRadius: 8, marginBottom: '0.75rem', color: '#ff5a5a' }}>{eventSaveError}</div>}
              {eventSaveSuccess && <div style={{ padding: '0.75rem', border: '1px solid #4caf50', borderRadius: 8, marginBottom: '0.75rem', color: '#4caf50' }}>{eventSaveSuccess}</div>}
              {eventForm(true)}
            </>
          )}

          {eventMode === 'edit' && selectedEvent != null && (
            <>
              <h2 style={{ margin: '0 0 1rem 0' }}>Edit: {selectedEvent.title}</h2>
              {eventSaveError && <div style={{ padding: '0.75rem', border: '1px solid #ff5a5a', borderRadius: 8, marginBottom: '0.75rem', color: '#ff5a5a' }}>{eventSaveError}</div>}
              {eventSaveSuccess && <div style={{ padding: '0.75rem', border: '1px solid #4caf50', borderRadius: 8, marginBottom: '0.75rem', color: '#4caf50' }}>{eventSaveSuccess}</div>}
              {eventForm(false)}
            </>
          )}
        </div>
      </div>
    </div>
  );

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
                      <label style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>Image URL</span>
                        <input value={editDraft.imageUrl} onChange={e => setEditDraft(d => ({ ...d, imageUrl: e.target.value }))} placeholder="https://example.org/photo.jpg" style={inputStyle} />
                      </label>
                      <div style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>Upload Image</span>
                        <ImageUploadControl
                          authToken={authToken}
                          uploadUrl={`/api/submissions/${sub.id}/image`}
                          hasImage={sub.has_image}
                          onChange={(has) => setSubmissions(prev => prev.map(s => (s.id === sub.id ? { ...s, has_image: has } : s)))}
                        />
                        <span style={{ fontSize: 13, opacity: 0.7 }}>An uploaded photo takes priority over the Image URL above.</span>
                      </div>

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
                      {(sub.has_image || sub.image_url) && (
                        <img
                          src={sub.has_image ? `/api/submissions/${sub.id}/image` : sub.image_url!}
                          alt=""
                          style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8 }}
                        />
                      )}
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
        <button type="button" onClick={() => setView('events')} style={tabBtnStyle(view === 'events')}>
          Events{events.length > 0 ? ` (${events.length})` : ''}
        </button>
      </div>

      {view === 'submissions' ? submissionsPanel : view === 'events' ? eventsPanel : (
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
