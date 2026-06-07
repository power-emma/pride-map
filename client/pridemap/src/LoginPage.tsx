import { useState } from 'react';

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

interface LoginPageProps {
  /** Called with the JWT token once login succeeds. */
  onLogin: (token: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? `Login failed (${res.status})`);
        return;
      }
      onLogin(json.token as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

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
        <h2 style={{ margin: 0 }}>Sign in to manage locations</h2>

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
            <span style={{ fontWeight: 600 }}>Username</span>
            <input
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.3rem' }}>
            <span style={{ fontWeight: 600 }}>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
            />
          </label>

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
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
