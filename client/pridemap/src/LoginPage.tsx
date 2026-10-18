import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n';
import { localizedApiError } from './localizedApiError';
import PasswordRequestForm from './components/PasswordRequestForm';
import type { AuthUser } from './auth';

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

const linkButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'inherit',
  textDecoration: 'underline',
  cursor: 'pointer',
  fontSize: 14,
  opacity: 0.85,
};

type Mode = 'login' | 'register' | 'reset';

interface LoginPageProps {
  /** Called with the JWT token and account once sign-in or sign-up succeeds. */
  onLogin: (token: string, user: AuthUser) => void;
  /** Optional line explaining why the visitor needs to sign in. */
  intro?: string;
}

export default function LoginPage({ onLogin, intro }: LoginPageProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword('');
    setConfirm('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const isRegister = mode === 'register';
    if (isRegister && password !== confirm) {
      setError(t('account.passwordsDontMatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(isRegister ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isRegister ? { username, email, password } : { username, password }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(localizedApiError(json?.code, res.status));
        return;
      }
      onLogin(json.token as string, json.user as AuthUser);
    } catch (err) {
      console.error(isRegister ? 'Registration request failed:' : 'Login request failed:', err);
      setError(t('errors.network'));
    } finally {
      setLoading(false);
    }
  }

  const title = mode === 'register' ? t('login.registerTitle') : mode === 'reset' ? t('login.resetTitle') : t('login.title');

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 'calc(100vh - 72px)',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          border: '1px solid #333',
          borderRadius: 12,
          padding: '2rem',
          display: 'grid',
          gap: '1.25rem',
        }}
      >
        <h2 style={{ margin: 0 }}>{title}</h2>
        {intro && mode !== 'reset' && <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>{intro}</p>}

        {mode === 'reset' ? (
          <PasswordRequestForm />
        ) : (
          <>
            {error && (
              <div
                style={{
                  padding: '0.75rem',
                  border: '1px solid #ff5a5a',
                  borderRadius: 8,
                  color: '#ff5a5a',
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
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
                {mode === 'register' && (
                  <span style={{ fontSize: 13, opacity: 0.7 }}>{t('login.usernameHelp')}</span>
                )}
              </label>

              {mode === 'register' && (
                <label style={{ display: 'grid', gap: '0.3rem' }}>
                  <span style={{ fontWeight: 600 }}>{t('login.email')}</span>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('create.emailPlaceholder')}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: 13, opacity: 0.7 }}>{t('login.emailHelp')}</span>
                </label>
              )}

              <label style={{ display: 'grid', gap: '0.3rem' }}>
                <span style={{ fontWeight: 600 }}>{t('login.password')}</span>
                <input
                  type="password"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  required
                  minLength={mode === 'register' ? 8 : undefined}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={inputStyle}
                />
              </label>

              {mode === 'register' && (
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
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.65rem',
                  borderRadius: 8,
                  border: '1px solid #555',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  marginTop: '0.25rem',
                }}
              >
                {mode === 'register'
                  ? (loading ? t('login.creatingAccount') : t('login.createAccount'))
                  : (loading ? t('login.signingIn') : t('login.signIn'))}
              </button>
            </form>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          {mode === 'login' ? (
            <>
              <button type="button" style={linkButtonStyle} onClick={() => switchMode('register')}>
                {t('login.needAccount')}
              </button>
              <button type="button" style={linkButtonStyle} onClick={() => switchMode('reset')}>
                {t('login.forgotPassword')}
              </button>
            </>
          ) : (
            <button type="button" style={linkButtonStyle} onClick={() => switchMode('login')}>
              {t('login.backToSignIn')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
