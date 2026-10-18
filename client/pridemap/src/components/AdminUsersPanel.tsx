import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../i18n';
import { localizedApiError } from '../localizedApiError';

type UserRow = {
  id: number;
  username: string;
  email: string | null;
  is_admin: boolean;
  created_at: string;
  location_count: number;
  event_count: number;
  pending_submission_count: number;
};

type PasswordRequest = {
  id: number;
  user_id: number;
  username: string;
  email: string | null;
  created_at: string;
};

interface AdminUsersPanelProps {
  authToken: string;
  /** The signed-in admin, who can't delete their own account. */
  currentUserId: number;
  onAuthError: () => void;
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

const pillStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '0.15rem 0.5rem',
  border: '1px solid #444',
  borderRadius: 999,
};

export default function AdminUsersPanel({ authToken, currentUserId, onAuthError }: AdminUsersPanelProps) {
  const { t, i18n } = useTranslation();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [requests, setRequests] = useState<PasswordRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null);
  // Account awaiting delete confirmation, and whether to take its content too.
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteContent, setDeleteContent] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const headers = { 'Authorization': `Bearer ${authToken}` };
    Promise.all([
      fetch('/api/users', { headers }),
      fetch('/api/users/password-requests', { headers }),
    ])
      .then(async ([usersRes, requestsRes]) => {
        if (usersRes.status === 401 || requestsRes.status === 401) { onAuthError(); return; }
        if (!usersRes.ok) throw new Error(String(usersRes.status));
        if (!requestsRes.ok) throw new Error(String(requestsRes.status));
        const [userRows, requestRows] = await Promise.all([usersRes.json(), requestsRes.json()]);
        if (cancelled) return;
        setUsers(userRows);
        setRequests(requestRows);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load accounts:', err);
        setError(i18nInstance.t('errors.network'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [authToken, onAuthError]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => u.username.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q));
  }, [users, search]);

  const formatDate = (value: string) =>
    new Date(value).toLocaleString(i18n.language.startsWith('fr') ? 'fr-CA' : 'en-CA');

  async function reviewRequest(request: PasswordRequest, action: 'approve' | 'deny') {
    setBusyRequestId(request.id);
    setError(null);
    try {
      const res = await fetch(`/api/users/password-requests/${request.id}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) { onAuthError(); return; }
      if (!res.ok) {
        setError(localizedApiError(json?.code, res.status));
        return;
      }
      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (err) {
      console.error(`Failed to ${action} password change request:`, err);
      setError(t('errors.network'));
    } finally {
      setBusyRequestId(null);
    }
  }

  function startDelete(user: UserRow) {
    setConfirmDeleteId(user.id);
    setDeleteContent(false);
  }

  async function confirmDelete(user: UserRow) {
    setDeletingId(user.id);
    setError(null);
    try {
      const res = await fetch(`/api/users/${user.id}?content=${deleteContent ? 'delete' : 'keep'}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) { onAuthError(); return; }
      if (!res.ok) {
        setError(localizedApiError(json?.code, res.status));
        return;
      }
      setUsers(prev => prev.filter(u => u.id !== user.id));
      setRequests(prev => prev.filter(r => r.user_id !== user.id));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Failed to delete account:', err);
      setError(t('errors.network'));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <div style={{ padding: '2rem' }}>{t('admin.loading')}</div>;

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.5rem' }}>
      <div style={{ maxWidth: 760, width: '100%', margin: '0 auto', display: 'grid', gap: '2rem' }}>
        {error && (
          <div style={{ padding: '0.75rem', border: '1px solid #ff5a5a', borderRadius: 8, color: '#ff5a5a' }}>
            {error}
          </div>
        )}

        <section style={{ display: 'grid', gap: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>{t('users.passwordRequests')}</h2>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.75 }}>{t('users.passwordRequestsHelp')}</p>
          {requests.length === 0 ? (
            <div style={{ opacity: 0.6 }}>{t('users.noPasswordRequests')}</div>
          ) : (
            requests.map(request => {
              const busy = busyRequestId === request.id;
              return (
                <div
                  key={request.id}
                  style={{ border: '1px solid #333', borderRadius: 10, padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
                >
                  <div style={{ display: 'grid', gap: '0.2rem' }}>
                    <strong>{request.username}</strong>
                    <span style={{ fontSize: 13, opacity: 0.75 }}>
                      {request.email
                        ? <a href={`mailto:${request.email}`} style={{ color: 'inherit' }}>{request.email}</a>
                        : t('users.noEmail')}
                      {' · '}{t('users.requestedAt', { date: formatDate(request.created_at) })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => reviewRequest(request, 'approve')}
                      disabled={busy}
                      style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: '1px solid #4caf50', color: '#4caf50', fontWeight: 700, background: 'transparent', cursor: busy ? 'not-allowed' : 'pointer' }}
                    >
                      {busy ? t('admin.working') : t('admin.approve')}
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewRequest(request, 'deny')}
                      disabled={busy}
                      style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: '1px solid #ff5a5a', color: '#ff5a5a', fontWeight: 700, background: 'transparent', cursor: busy ? 'not-allowed' : 'pointer' }}
                    >
                      {busy ? t('admin.working') : t('users.deny')}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <section style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>{t('users.accounts')}</h2>
            <span style={{ fontSize: 13, opacity: 0.6 }}>{t('users.accountsPlural', { count: users.length })}</span>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('users.search')}
            style={inputStyle}
          />
          {filteredUsers.length === 0 && <div style={{ opacity: 0.6 }}>{t('users.noAccounts')}</div>}
          {filteredUsers.map(user => {
            const isSelf = user.id === currentUserId;
            const confirming = confirmDeleteId === user.id;
            const deleting = deletingId === user.id;
            const hasContent = user.location_count > 0 || user.event_count > 0;
            return (
              <div key={user.id} style={{ border: '1px solid #333', borderRadius: 10, padding: '0.85rem 1rem', display: 'grid', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong>{user.username}</strong>
                    {user.is_admin && <span style={pillStyle}>{t('users.admin')}</span>}
                    {isSelf && <span style={{ ...pillStyle, opacity: 0.7 }}>{t('users.you')}</span>}
                  </div>
                  <span style={{ fontSize: 12, opacity: 0.55 }}>{t('users.joined', { date: formatDate(user.created_at) })}</span>
                </div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {user.email
                    ? <a href={`mailto:${user.email}`} style={{ color: 'inherit' }}>{user.email}</a>
                    : t('users.noEmail')}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={pillStyle}>{t('admin.locationsPlural', { count: user.location_count })}</span>
                  <span style={pillStyle}>{t('admin.eventsPlural', { count: user.event_count })}</span>
                  {user.pending_submission_count > 0 && (
                    <span style={pillStyle}>{t('users.pendingPlural', { count: user.pending_submission_count })}</span>
                  )}
                </div>

                {!isSelf && !confirming && (
                  <div>
                    <button
                      type="button"
                      onClick={() => startDelete(user)}
                      style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: '1px solid #444', fontWeight: 600, background: 'transparent', color: 'inherit', cursor: 'pointer' }}
                    >
                      {t('users.deleteAccount')}
                    </button>
                  </div>
                )}

                {confirming && (
                  <div style={{ display: 'grid', gap: '0.6rem', padding: '0.75rem', border: '1px solid #ff5a5a', borderRadius: 8 }}>
                    <div style={{ fontSize: 14 }}>{t('users.confirmDeleteText', { username: user.username })}</div>
                    {hasContent && (
                      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: 14 }}>
                        <input type="checkbox" checked={deleteContent} onChange={e => setDeleteContent(e.target.checked)} />
                        {t('users.alsoDeleteContent', { locations: user.location_count, events: user.event_count })}
                      </label>
                    )}
                    {hasContent && !deleteContent && (
                      <div style={{ fontSize: 13, opacity: 0.7 }}>{t('users.contentKept')}</div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => confirmDelete(user)}
                        disabled={deleting}
                        style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: '1px solid #ff5a5a', color: '#ff5a5a', fontWeight: 700, background: 'transparent', cursor: deleting ? 'not-allowed' : 'pointer' }}
                      >
                        {deleting ? t('admin.deleting') : t('admin.confirmDelete')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deleting}
                        style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: '1px solid #444', background: 'transparent', color: 'inherit', cursor: 'pointer' }}
                      >
                        {t('admin.cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
