import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18nInstance from './i18n';
import CategoryCheckboxes from './components/CategoryCheckboxes';
import ImageUploadControl from './components/ImageUploadControl';
import AdminUsersPanel from './components/AdminUsersPanel';
import AccountPanel from './components/AccountPanel';
import { CITY_NAME } from './config';
import { localizedApiError } from './localizedApiError';
import type { AuthUser } from './auth';

type Category = { id: number; name: string };

type Location = {
  id: number;
  name: string;
  name_fr: string | null;
  description: string | null;
  description_fr: string | null;
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
  title_fr: string | null;
  description: string | null;
  description_fr: string | null;
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
  name_fr: string | null;
  description: string | null;
  description_fr: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  url: string | null;
  image_url: string | null;
  has_image: boolean;
  submitter_email: string | null;
  submitter_username?: string | null;
  category_ids: number[];
  status: string;
  created_at: string;
};

interface ManageLocationsPageProps {
  /** JWT token to attach to API requests. */
  authToken: string;
  /**
   * The signed-in account. Admins manage everything and review the queue;
   * everyone else sees and manages only their own content.
   */
  user: AuthUser;
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

function submissionStatusColour(status: string) {
  if (status === 'approved') return '#4caf50';
  if (status === 'rejected') return '#ff5a5a';
  return '#e0b84c';
}

export default function ManageLocationsPage({ authToken, user, onAuthError }: ManageLocationsPageProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isAdmin = user.isAdmin;
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Top-level view: edit live locations, the submissions queue (admins review
  // it; users follow their own), the "Happening in <city>" events cards,
  // accounts (admins only), or the signed-in user's own account.
  const [view, setView] = useState<'locations' | 'submissions' | 'events' | 'users' | 'account'>('locations');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  // Tracks which submission ids currently have an approve/reject request in flight.
  const [busySubmissionId, setBusySubmissionId] = useState<number | null>(null);
  // Inline editing of a pending submission before approval.
  const [editingSubmissionId, setEditingSubmissionId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: '', nameFr: '', email: '', description: '', descriptionFr: '', address: '',
    latitude: '', longitude: '', url: '', imageUrl: '', categoryIds: [] as number[],
  });
  const [savingSubmission, setSavingSubmission] = useState(false);

  // Events management ("Happening in <city>" cards on the main map).
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventMode, setEventMode] = useState<'idle' | 'edit' | 'create'>('idle');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventTitleFr, setEventTitleFr] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDescriptionFr, setEventDescriptionFr] = useState('');
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
  const [nameFr, setNameFr] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionFr, setDescriptionFr] = useState('');
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
      fetch(isAdmin ? '/api/locations' : '/api/locations/mine', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      }),
      fetch('/api/categories'),
    ])
      .then(async ([locsRes, catsRes]) => {
        if (locsRes.status === 401) { onAuthError(); return; }
        if (!locsRes.ok) throw new Error(String(locsRes.status));
        if (!catsRes.ok) throw new Error(String(catsRes.status));
        setLocations(await locsRes.json());
        setCategories(await catsRes.json());
      })
      .catch(err => {
        console.error('Failed to load admin location data:', err);
        setLoadError(i18nInstance.t('errors.network'));
      })
      .finally(() => setLoading(false));
  }, [authToken, isAdmin, onAuthError]);

  // Admins load the pending review queue; everyone else their own submissions.
  useEffect(() => {
    let cancelled = false;
    setSubmissionsError(null);
    fetch(isAdmin ? '/api/submissions?status=pending' : '/api/submissions/mine', {
      headers: { 'Authorization': `Bearer ${authToken}` },
    })
      .then(async (res) => {
        if (res.status === 401) { onAuthError(); return []; }
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((rows: Submission[]) => {
        if (!cancelled) setSubmissions(rows ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load submissions:', err);
          setSubmissionsError(i18nInstance.t('errors.network'));
        }
      });
    return () => { cancelled = true; };
  }, [authToken, isAdmin, onAuthError]);

  // Load events for management (including past ones): all of them for admins,
  // otherwise just the user's own.
  useEffect(() => {
    let cancelled = false;
    setEventsError(null);
    fetch(isAdmin ? '/api/events/all' : '/api/events/mine', {
      headers: { 'Authorization': `Bearer ${authToken}` },
    })
      .then(async (res) => {
        if (res.status === 401) { onAuthError(); return []; }
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((rows: EventItem[]) => {
        if (!cancelled) setEvents(rows ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load events:', err);
          setEventsError(i18nInstance.t('errors.network'));
        }
      });
    return () => { cancelled = true; };
  }, [authToken, isAdmin, onAuthError]);

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
        setSubmissionsError(localizedApiError(json?.code, res.status));
        return;
      }
      // Reflect the new live location without a refetch.
      const newLoc: Location = {
        id: json.locationId,
        name: sub.name,
        name_fr: sub.name_fr,
        description: sub.description,
        description_fr: sub.description_fr,
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
      console.error('Failed to approve submission:', err);
      setSubmissionsError(t('errors.network'));
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
        setSubmissionsError(localizedApiError(json?.code, res.status));
        return;
      }
      setSubmissions(prev => prev.filter(s => s.id !== sub.id));
    } catch (err) {
      console.error('Failed to reject submission:', err);
      setSubmissionsError(t('errors.network'));
    } finally {
      setBusySubmissionId(null);
    }
  }

  async function handleWithdraw(sub: Submission) {
    setBusySubmissionId(sub.id);
    setSubmissionsError(null);
    try {
      const res = await fetch(`/api/submissions/${sub.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) { onAuthError(); return; }
      if (!res.ok) {
        setSubmissionsError(localizedApiError(json?.code, res.status));
        return;
      }
      setSubmissions(prev => prev.filter(s => s.id !== sub.id));
    } catch (err) {
      console.error('Failed to withdraw submission:', err);
      setSubmissionsError(t('errors.network'));
    } finally {
      setBusySubmissionId(null);
    }
  }

  function startEditSubmission(sub: Submission) {
    setSubmissionsError(null);
    setEditingSubmissionId(sub.id);
    setEditDraft({
      name: sub.name,
      nameFr: sub.name_fr ?? '',
      email: sub.submitter_email ?? '',
      description: sub.description ?? '',
      descriptionFr: sub.description_fr ?? '',
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
      setSubmissionsError(t('errors.invalidCoordinates'));
      return;
    }

    const payload = {
      name: editDraft.name.trim(),
      name_fr: toNullIfEmpty(editDraft.nameFr),
      // Only admins can change the contact email; blank keeps the current one.
      submitter_email: isAdmin ? toNullIfEmpty(editDraft.email) : null,
      description: toNullIfEmpty(editDraft.description),
      description_fr: toNullIfEmpty(editDraft.descriptionFr),
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
        setSubmissionsError(localizedApiError(json?.code, res.status));
        return;
      }
      // Merge the saved values back into the list.
      setSubmissions(prev => prev.map(s => (s.id === sub.id ? { ...s, ...json } : s)));
      setEditingSubmissionId(null);
    } catch (err) {
      console.error('Failed to save submission:', err);
      setSubmissionsError(t('errors.network'));
    } finally {
      setSavingSubmission(false);
    }
  }

  function clearForm() {
    setName('');
    setNameFr('');
    setDescription('');
    setDescriptionFr('');
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
      setGeocodeError(t('admin.geocodeAddress'));
      return;
    }

    setGeocodeError(null);
    setGeocoding(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`
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
        setGeocodeError(t('admin.noAddresses'));
        return;
      }

      setGeocodeResults(results);
    } catch (err) {
      setGeocodeResults([]);
      console.error('Could not geocode address:', err);
      setGeocodeError(t('admin.geocodeFailed'));
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
    setNameFr(loc.name_fr ?? '');
    setDescription(loc.description ?? '');
    setDescriptionFr(loc.description_fr ?? '');
    setAddress(loc.address ?? '');
    setLatitude(loc.latitude != null ? String(loc.latitude) : '');
    setLongitude(loc.longitude != null ? String(loc.longitude) : '');
    setUrl(loc.url ?? '');
    setImageUrl(loc.image_url ?? '');
    setHasImage(loc.has_image);
    setCategoryIds(loc.category_ids);
  }

  function openCreate() {
    // Only admins publish directly; everyone else goes through review.
    if (!isAdmin) {
      navigate('/create-location');
      return;
    }
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
      setSaveError(t('errors.invalidCoordinates'));
      return;
    }

    const payload = {
      name: name.trim(),
      name_fr: toNullIfEmpty(nameFr),
      description: toNullIfEmpty(description),
      description_fr: toNullIfEmpty(descriptionFr),
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
        setSaveError(localizedApiError(json?.code, res.status));
        return;
      }

      setLocations(prev =>
        prev.map(l =>
          l.id === selectedId
            ? { ...l, ...payload }
            : l
        )
      );
      setSaveSuccess(t('admin.savedSuccessfully'));
    } catch (err) {
      console.error('Failed to save location:', err);
      setSaveError(t('errors.network'));
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
      setSaveError(t('errors.invalidCoordinates'));
      return;
    }

    const payload = {
      name: name.trim(),
      name_fr: toNullIfEmpty(nameFr),
      description: toNullIfEmpty(description),
      description_fr: toNullIfEmpty(descriptionFr),
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
        setSaveError(localizedApiError(json?.code, res.status));
        return;
      }

      const newLoc: Location = { id: json.id, ...payload, has_image: false, category_ids: payload.category_ids };
      setLocations(prev => [...prev, newLoc].sort((a, b) => a.name.localeCompare(b.name)));
      setSaveSuccess(t('admin.locationCreated'));
      // Switch to editing the new location
      setSelectedId(json.id);
      setMode('edit');
    } catch (err) {
      console.error('Failed to create location:', err);
      setSaveError(t('errors.network'));
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
        setSaveError(localizedApiError(json?.code, res.status));
        setDeleting(false);
        return;
      }
      setLocations(prev => prev.filter(l => l.id !== selectedId));
      setSelectedId(null);
      setMode('idle');
      setConfirmDelete(false);
    } catch (err) {
      console.error('Failed to delete location:', err);
      setSaveError(t('errors.network'));
    } finally {
      setDeleting(false);
    }
  }

  function clearEventForm() {
    setEventTitle('');
    setEventTitleFr('');
    setEventDescription('');
    setEventDescriptionFr('');
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
    setEventTitleFr(ev.title_fr ?? '');
    setEventDescription(ev.description ?? '');
    setEventDescriptionFr(ev.description_fr ?? '');
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
      title_fr: toNullIfEmpty(eventTitleFr),
      description: toNullIfEmpty(eventDescription),
      description_fr: toNullIfEmpty(eventDescriptionFr),
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
        setEventSaveError(localizedApiError(json?.code, res.status));
        return;
      }

      setEvents(prev => [...prev, { ...json, has_image: false }].sort((a, b) => a.event_date.localeCompare(b.event_date)));
      setEventSaveSuccess(t('admin.eventCreated'));
      setSelectedEventId(json.id);
      setEventMode('edit');
    } catch (err) {
      console.error('Failed to create event:', err);
      setEventSaveError(t('errors.network'));
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
        setEventSaveError(localizedApiError(json?.code, res.status));
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
      setEventSaveSuccess(t('admin.savedSuccessfully'));
    } catch (err) {
      console.error('Failed to save event:', err);
      setEventSaveError(t('errors.network'));
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
        setEventSaveError(localizedApiError(json?.code, res.status));
        setEventDeleting(false);
        return;
      }
      setEvents(prev => prev.filter(ev => ev.id !== selectedEventId));
      setSelectedEventId(null);
      setEventMode('idle');
      setConfirmEventDelete(false);
    } catch (err) {
      console.error('Failed to delete event:', err);
      setEventSaveError(t('errors.network'));
    } finally {
      setEventDeleting(false);
    }
  }

  const selectedEvent = events.find(ev => ev.id === selectedEventId) ?? null;

  const pendingCount = submissions.filter(s => s.status === 'pending').length;

  const selectedLocation = locations.find(l => l.id === selectedId) ?? null;

  if (loading) return <div style={{ padding: '2rem' }}>{t('admin.loading')}</div>;
  if (loadError) return <div style={{ padding: '2rem', color: '#ff5a5a' }}>{t('admin.error')}: {loadError}</div>;

  const sharedForm = (isCreate: boolean) => (
    <form onSubmit={isCreate ? handleCreate : handleSave} style={{ display: 'grid', gap: '0.75rem' }}>
      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.englishName')}</span>
        <input value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
      </label>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.frenchName')}</span>
        <input value={nameFr} onChange={e => setNameFr(e.target.value)} style={inputStyle} />
      </label>

      <div style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.categories')}</span>
        <CategoryCheckboxes
          categories={categories}
          loading={false}
          selected={categoryIds}
          onChange={setCategoryIds}
        />
      </div>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.englishDescription')}</span>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} style={inputStyle} />
      </label>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.frenchDescription')}</span>
        <textarea value={descriptionFr} onChange={e => setDescriptionFr(e.target.value)} rows={4} style={inputStyle} />
      </label>

      <div style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.address')}</span>
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
            {geocoding ? t('admin.geocoding') : t('admin.geocode')}
          </button>
        </div>

        {geocodeError && (
          <div style={{ color: '#ff9a9a', fontSize: 13 }}>{geocodeError}</div>
        )}

        {geocodeResults.length > 0 && (
          <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: 13, opacity: 0.8 }}>{t('admin.chooseAddress')}</div>
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
        <label style={labelStyle}>
          <span style={{ fontWeight: 600 }}>{t('admin.latitude')}</span>
          <input value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="e.g. 45.421" inputMode="decimal" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          <span style={{ fontWeight: 600 }}>{t('admin.longitude')}</span>
          <input value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="e.g. -75.690" inputMode="decimal" style={inputStyle} />
        </label>
      </div>
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        {t('admin.coordinatesHelp')}
      </div>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.website')}</span>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.org" style={inputStyle} />
      </label>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.imageUrl')}</span>
        <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.org/photo.jpg" style={inputStyle} />
      </label>
      {!hasImage && imageUrl.trim() && (
        <img src={imageUrl} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8 }} />
      )}

      <div style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.uploadImage')}</span>
        <ImageUploadControl
          authToken={authToken}
          uploadUrl={!isCreate && selectedId != null ? `/api/locations/${selectedId}/image` : null}
          hasImage={hasImage}
          onChange={setHasImage}
        />
        <span style={{ fontSize: 13, opacity: 0.7 }}>{t('admin.uploadedImageHelp')}</span>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={saving || name.trim().length === 0}
          style={{ padding: '0.6rem 1.1rem', borderRadius: 8, border: '1px solid #444', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? (isCreate ? t('admin.creating') : t('admin.saving')) : (isCreate ? t('admin.createLocation') : t('admin.saveChanges'))}
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
            {deleting ? t('admin.deleting') : confirmDelete ? t('admin.confirmDelete') : t('admin.delete')}
          </button>
        )}

        {confirmDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            style={{ padding: '0.6rem 0.9rem', borderRadius: 8, border: '1px solid #444', cursor: 'pointer' }}
          >
            {t('admin.cancel')}
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
        <span style={{ fontWeight: 600 }}>{t('admin.eventsTitle')}</span>
        <input value={eventTitle} onChange={e => setEventTitle(e.target.value)} style={inputStyle} />
      </label>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.eventTitleFrench')}</span>
        <input value={eventTitleFr} onChange={e => setEventTitleFr(e.target.value)} style={inputStyle} />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <label style={labelStyle}>
          <span style={{ fontWeight: 600 }}>{t('admin.eventDate')}</span>
          <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required style={inputStyle} />
        </label>
        <label style={labelStyle}>
          <span style={{ fontWeight: 600 }}>{t('admin.eventTime')}</span>
          <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} style={inputStyle} />
        </label>
      </div>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.eventDescriptionEnglish')}</span>
        <textarea value={eventDescription} onChange={e => setEventDescription(e.target.value)} rows={4} style={inputStyle} />
      </label>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.eventDescriptionFrench')}</span>
        <textarea value={eventDescriptionFr} onChange={e => setEventDescriptionFr(e.target.value)} rows={4} style={inputStyle} />
      </label>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.venue')}</span>
        <input value={eventLocation} onChange={e => setEventLocation(e.target.value)} placeholder={t('admin.venuePlaceholder')} style={inputStyle} />
      </label>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.linkedBusiness')}</span>
        <select
          value={eventLocationId ?? ''}
          onChange={e => setEventLocationId(e.target.value ? Number(e.target.value) : null)}
          style={inputStyle}
        >
          <option value="">{t('admin.none')}</option>
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
      </label>
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        {t('admin.linkedImageHelp')}
      </div>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.city')}</span>
        <input value={eventCity} onChange={e => setEventCity(e.target.value)} required style={inputStyle} />
      </label>
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        {t('admin.cityMatchHelp', { city: CITY_NAME })}
      </div>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.website')}</span>
        <input value={eventUrl} onChange={e => setEventUrl(e.target.value)} placeholder="https://example.org" style={inputStyle} />
      </label>

      <label style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.imageUrl')}</span>
        <input value={eventImageUrl} onChange={e => setEventImageUrl(e.target.value)} placeholder="https://example.org/photo.jpg" style={inputStyle} />
      </label>

      <div style={labelStyle}>
        <span style={{ fontWeight: 600 }}>{t('admin.uploadImage')}</span>
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
              <span style={{ fontSize: 12, opacity: 0.6 }}>{t('admin.eventImageFallback')}</span>
            )}
          </div>
        );
      })()}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={eventSaving || (eventTitle.trim().length === 0 && eventTitleFr.trim().length === 0) || eventDate.trim().length === 0}
          style={{ padding: '0.6rem 1.1rem', borderRadius: 8, border: '1px solid #444', fontWeight: 700, cursor: eventSaving ? 'not-allowed' : 'pointer' }}
        >
          {eventSaving ? (isCreate ? t('admin.creating') : t('admin.saving')) : (isCreate ? t('admin.createEvent') : t('admin.saveChanges'))}
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
            {eventDeleting ? t('admin.deleting') : confirmEventDelete ? t('admin.confirmDelete') : t('admin.delete')}
          </button>
        )}

        {confirmEventDelete && (
          <button
            type="button"
            onClick={() => setConfirmEventDelete(false)}
            style={{ padding: '0.6rem 0.9rem', borderRadius: 8, border: '1px solid #444', cursor: 'pointer' }}
          >
            {t('admin.cancel')}
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
            {t('admin.addEvent')}
          </button>
        </div>
        {eventsError && (
          <div style={{ padding: '0.75rem', color: '#ff5a5a', fontSize: 13 }}>{eventsError}</div>
        )}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {events.length === 0 && (
            <div style={{ padding: '1rem', opacity: 0.6 }}>{t('admin.noEvents')}</div>
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
              <div style={{ fontSize: 14 }}>{i18n.language.startsWith('fr') ? ev.title_fr || ev.title : ev.title}</div>
              <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>
                {ev.event_date.slice(0, 10)}{ev.event_time ? ` · ${ev.event_time.slice(0, 5)}` : ''} — {ev.city}
              </div>
            </button>
          ))}
        </div>
        <div style={{ padding: '0.6rem', borderTop: '1px solid #333', fontSize: 12, opacity: 0.5 }}>
          {t('admin.eventsPlural', { count: events.length })}
        </div>
      </div>

      <div style={{ overflowY: 'auto', padding: '1.5rem' }}>
        <div style={{ maxWidth: 640, width: '100%', margin: '0 auto' }}>
          {eventMode === 'idle' && (
            <div style={{ opacity: 0.5, marginTop: '2rem', textAlign: 'center' }}>
              {t('admin.selectEvent')} <strong>{t('admin.addEvent')}</strong>.
            </div>
          )}

          {eventMode === 'create' && (
            <>
              <h2 style={{ margin: '0 0 1rem 0' }}>{t('admin.addEventTitle')}</h2>
              {eventSaveError && <div style={{ padding: '0.75rem', border: '1px solid #ff5a5a', borderRadius: 8, marginBottom: '0.75rem', color: '#ff5a5a' }}>{eventSaveError}</div>}
              {eventSaveSuccess && <div style={{ padding: '0.75rem', border: '1px solid #4caf50', borderRadius: 8, marginBottom: '0.75rem', color: '#4caf50' }}>{eventSaveSuccess}</div>}
              {eventForm(true)}
            </>
          )}

          {eventMode === 'edit' && selectedEvent != null && (
            <>
              <h2 style={{ margin: '0 0 1rem 0' }}>{t('admin.edit')}: {i18n.language.startsWith('fr') ? selectedEvent.title_fr || selectedEvent.title : selectedEvent.title}</h2>
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
        <h2 style={{ margin: '0 0 1rem 0' }}>{isAdmin ? t('admin.pendingSubmissions') : t('admin.mySubmissions')}</h2>
        {!isAdmin && (
          <p style={{ margin: '0 0 1rem 0', opacity: 0.75, fontSize: 14 }}>{t('admin.mySubmissionsHelp')}</p>
        )}
        {submissionsError && (
          <div style={{ padding: '0.75rem', border: '1px solid #ff5a5a', borderRadius: 8, marginBottom: '0.75rem', color: '#ff5a5a' }}>
            {submissionsError}
          </div>
        )}
        {submissions.length === 0 ? (
          <div style={{ opacity: 0.6, marginTop: '2rem', textAlign: 'center' }}>
            {isAdmin ? t('admin.noPendingSubmissions') : t('admin.noSubmissions')}
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
              const isPending = sub.status === 'pending';
              return (
                <div key={sub.id} style={{ border: '1px solid #333', borderRadius: 10, padding: '1rem', display: 'grid', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0 }}>{isEditing ? t('admin.editingSubmission') : sub.name}</h3>
                    <span style={{ fontSize: 12, opacity: 0.55 }}>
                      {!isAdmin && (
                        <span style={{ marginRight: '0.5rem', padding: '0.1rem 0.5rem', border: `1px solid ${submissionStatusColour(sub.status)}`, borderRadius: 999, color: submissionStatusColour(sub.status) }}>
                          {t(`admin.status_${sub.status}`)}
                        </span>
                      )}
                      {new Date(sub.created_at).toLocaleString(i18n.language === 'fr' ? 'fr-CA' : 'en-CA')}
                    </span>
                  </div>

                  {isEditing ? (
                    <div style={{ display: 'grid', gap: '0.6rem' }}>
                      <label style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>{t('admin.englishName')}</span>
                        <input value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} style={inputStyle} />
                      </label>
                      <label style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>{t('admin.frenchName')}</span>
                        <input value={editDraft.nameFr} onChange={e => setEditDraft(d => ({ ...d, nameFr: e.target.value }))} style={inputStyle} />
                      </label>
                      {isAdmin && (
                        <label style={labelStyle}>
                          <span style={{ fontWeight: 600 }}>{t('admin.submitterEmail')}</span>
                          <input value={editDraft.email} onChange={e => setEditDraft(d => ({ ...d, email: e.target.value }))} style={inputStyle} />
                        </label>
                      )}
                      <div style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>{t('admin.categories')}</span>
                        <CategoryCheckboxes
                          categories={categories}
                          loading={false}
                          selected={editDraft.categoryIds}
                          onChange={ids => setEditDraft(d => ({ ...d, categoryIds: ids }))}
                        />
                      </div>
                      <label style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>{t('admin.englishDescription')}</span>
                        <textarea value={editDraft.description} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))} rows={4} style={inputStyle} />
                      </label>
                      <label style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>{t('admin.frenchDescription')}</span>
                        <textarea value={editDraft.descriptionFr} onChange={e => setEditDraft(d => ({ ...d, descriptionFr: e.target.value }))} rows={4} style={inputStyle} />
                      </label>
                      <label style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>{t('admin.address')}</span>
                        <input value={editDraft.address} onChange={e => setEditDraft(d => ({ ...d, address: e.target.value }))} style={inputStyle} />
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <label style={labelStyle}>
                          <span style={{ fontWeight: 600 }}>{t('admin.latitude')}</span>
                          <input value={editDraft.latitude} onChange={e => setEditDraft(d => ({ ...d, latitude: e.target.value }))} placeholder="e.g. 45.421" inputMode="decimal" style={inputStyle} />
                        </label>
                        <label style={labelStyle}>
                          <span style={{ fontWeight: 600 }}>{t('admin.longitude')}</span>
                          <input value={editDraft.longitude} onChange={e => setEditDraft(d => ({ ...d, longitude: e.target.value }))} placeholder="e.g. -75.690" inputMode="decimal" style={inputStyle} />
                        </label>
                      </div>
                      <label style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>{t('admin.website')}</span>
                        <input value={editDraft.url} onChange={e => setEditDraft(d => ({ ...d, url: e.target.value }))} placeholder="https://example.org" style={inputStyle} />
                      </label>
                      <label style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>{t('admin.imageUrl')}</span>
                        <input value={editDraft.imageUrl} onChange={e => setEditDraft(d => ({ ...d, imageUrl: e.target.value }))} placeholder="https://example.org/photo.jpg" style={inputStyle} />
                      </label>
                      <div style={labelStyle}>
                        <span style={{ fontWeight: 600 }}>{t('admin.uploadImage')}</span>
                        <ImageUploadControl
                          authToken={authToken}
                          uploadUrl={`/api/submissions/${sub.id}/image`}
                          hasImage={sub.has_image}
                          onChange={(has) => setSubmissions(prev => prev.map(s => (s.id === sub.id ? { ...s, has_image: has } : s)))}
                        />
                        <span style={{ fontSize: 13, opacity: 0.7 }}>{t('admin.uploadedImageHelp')}</span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                        <button
                          type="button"
                          onClick={() => saveSubmissionEdit(sub)}
                          disabled={savingSubmission || (editDraft.name.trim().length === 0 && editDraft.nameFr.trim().length === 0)}
                          style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #4caf50', color: '#4caf50', fontWeight: 700, cursor: savingSubmission ? 'not-allowed' : 'pointer', background: 'transparent' }}
                        >
                          {savingSubmission ? t('admin.saving') : t('admin.saveChanges')}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditSubmission}
                          disabled={savingSubmission}
                          style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #444', fontWeight: 600, cursor: 'pointer', background: 'transparent', color: 'inherit' }}
                        >
                          {t('admin.cancel')}
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
                      {isAdmin && (
                        <div style={{ fontSize: 13 }}>
                          <strong>{t('admin.submittedBy')}</strong>{' '}
                          {sub.submitter_username ?? t('admin.deletedAccount')}
                          {sub.submitter_email && (
                            <>
                              {' · '}
                              <a href={`mailto:${sub.submitter_email}`} style={{ color: 'inherit' }}>{sub.submitter_email}</a>
                            </>
                          )}
                        </div>
                      )}

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
                        <div style={{ fontSize: 13 }}><strong>{t('admin.address')}:</strong> {sub.address}</div>
                      )}
                      <div style={{ fontSize: 13 }}>
                        <strong>{t('admin.coordinates')}</strong>{' '}
                        {hasPin ? `${sub.latitude}, ${sub.longitude}` : <span style={{ opacity: 0.6 }}>{t('admin.noPin')}</span>}
                      </div>
                      {sub.url && (
                        <div style={{ fontSize: 13 }}>
                          <strong>{t('admin.website')}:</strong>{' '}
                          <a href={sub.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{sub.url}</a>
                        </div>
                      )}

                      {isAdmin ? (
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => handleApprove(sub)}
                          disabled={busy}
                          style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #4caf50', color: '#4caf50', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', background: 'transparent' }}
                        >
                          {busy ? t('admin.working') : t('admin.approve')}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditSubmission(sub)}
                          disabled={busy}
                          style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #555', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', background: 'transparent', color: 'inherit' }}
                        >
                          {t('admin.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(sub)}
                          disabled={busy}
                          style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #ff5a5a', color: '#ff5a5a', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', background: 'transparent' }}
                        >
                          {busy ? t('admin.working') : t('admin.reject')}
                        </button>
                      </div>
                      ) : isPending && (
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => startEditSubmission(sub)}
                          disabled={busy}
                          style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #555', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', background: 'transparent', color: 'inherit' }}
                        >
                          {t('admin.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleWithdraw(sub)}
                          disabled={busy}
                          style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #ff5a5a', color: '#ff5a5a', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', background: 'transparent' }}
                        >
                          {busy ? t('admin.working') : t('admin.withdraw')}
                        </button>
                      </div>
                      )}
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
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid #333', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={() => setView('locations')} style={tabBtnStyle(view === 'locations')}>
          {isAdmin ? t('admin.tabsLocations') : t('admin.tabsMyLocations')}
        </button>
        <button type="button" onClick={() => setView('submissions')} style={tabBtnStyle(view === 'submissions')}>
          {isAdmin
            ? (pendingCount > 0 ? t('admin.submissionPlural', { count: pendingCount }) : t('admin.tabsSubmissions'))
            : (pendingCount > 0 ? t('admin.mySubmissionPlural', { count: pendingCount }) : t('admin.mySubmissions'))}
        </button>
        <button type="button" onClick={() => setView('events')} style={tabBtnStyle(view === 'events')}>
          {events.length > 0 ? t('admin.eventsPlural', { count: events.length }) : t('admin.tabsEvents')}
        </button>
        {isAdmin && (
          <button type="button" onClick={() => setView('users')} style={tabBtnStyle(view === 'users')}>
            {t('admin.tabsUsers')}
          </button>
        )}
        <button type="button" onClick={() => setView('account')} style={tabBtnStyle(view === 'account')}>
          {t('admin.tabsAccount')}
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 13, opacity: 0.6 }}>
          {t(isAdmin ? 'admin.signedInAsAdmin' : 'admin.signedInAs', { username: user.username })}
        </span>
      </div>

      {view === 'submissions' ? submissionsPanel
        : view === 'events' ? eventsPanel
        : view === 'users' && isAdmin ? <AdminUsersPanel authToken={authToken} currentUserId={user.id} onAuthError={onAuthError} />
        : view === 'account' ? <AccountPanel user={user} />
        : (
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
            {isAdmin ? t('admin.addLocation') : t('admin.submitLocation')}
          </button>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('admin.searchLocations')}
            style={{ ...inputStyle }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filteredLocations.length === 0 && (
            <div style={{ padding: '1rem', opacity: 0.6 }}>
              {isAdmin || locations.length > 0 ? t('admin.noLocations') : t('admin.noOwnLocations')}
            </div>
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
          {t('admin.locationsPlural', { count: filteredLocations.length })}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ overflowY: 'auto', padding: '1.5rem' }}>
        <div style={{ maxWidth: 640, width: '100%', margin: '0 auto' }}>
        {mode === 'idle' && (
          <div style={{ opacity: 0.5, marginTop: '2rem', textAlign: 'center' }}>
            {t('admin.selectLocation')} <strong>{isAdmin ? t('admin.addLocation') : t('admin.submitLocation')}</strong>.
          </div>
        )}

        {mode === 'create' && (
          <>
            <h2 style={{ margin: '0 0 1rem 0' }}>{t('admin.addLocationTitle')}</h2>
            {saveError && <div style={{ padding: '0.75rem', border: '1px solid #ff5a5a', borderRadius: 8, marginBottom: '0.75rem', color: '#ff5a5a' }}>{saveError}</div>}
            {saveSuccess && <div style={{ padding: '0.75rem', border: '1px solid #4caf50', borderRadius: 8, marginBottom: '0.75rem', color: '#4caf50' }}>{saveSuccess}</div>}
            {sharedForm(true)}
          </>
        )}

        {mode === 'edit' && selectedLocation != null && (
          <>
            <h2 style={{ margin: '0 0 1rem 0' }}>{t('admin.edit')}: {selectedLocation.name}</h2>
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
