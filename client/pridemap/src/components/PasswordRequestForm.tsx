import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizedApiError } from '../localizedApiError';

const inputStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderRadius: 8,
  border: '1px solid #444',
  background: '#1a1a1a',
  color: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
  fontSize: '1rem',
};

interface PasswordRequestFormProps {
  /** Pre-fills (and locks) the username, e.g. from the signed-in account. */
  username?: string;
}

/**
 * Files a password change request. Nothing changes until an admin approves it
 * from the dashboard, so this serves both "forgot password" and "change my
 * password".
 */
export default function PasswordRequestForm({ username: fixedUsername }: PasswordRequestFormProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState(fixedUsername ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t('account.passwordsDontMatch'));
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/auth/password-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), new_password: password }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(localizedApiError(json?.code, res.status));
        return;
      }
      setSent(true);
      setPassword('');
      setConfirm('');
    } catch (err) {
      console.error('Password change request failed:', err);
      setError(t('errors.network'));
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" style={{ padding: '0.75rem', border: '1px solid #4caf50', borderRadius: 8, color: '#4caf50', fontSize: 14 }}>
        {t('account.requestSent')}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
      <p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>{t('account.requestHelp')}</p>

      {error && (
        <div style={{ padding: '0.75rem', border: '1px solid #ff5a5a', borderRadius: 8, color: '#ff5a5a', fontSize: 14 }}>
          {error}
        </div>
      )}

      {fixedUsername === undefined && (
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={{ fontWeight: 600 }}>{t('login.username')}</span>
          <input
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={e => setUsername(e.target.value)}
            style={inputStyle}
          />
        </label>
      )}

      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontWeight: 600 }}>{t('account.newPassword')}</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontWeight: 600 }}>{t('account.confirmPassword')}</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          style={inputStyle}
        />
      </label>

      <button
        type="submit"
        disabled={sending}
        style={{
          padding: '0.65rem',
          borderRadius: 8,
          border: '1px solid #555',
          fontWeight: 700,
          fontSize: '1rem',
          cursor: sending ? 'not-allowed' : 'pointer',
        }}
      >
        {sending ? t('account.sendingRequest') : t('account.sendRequest')}
      </button>
    </form>
  );
}
