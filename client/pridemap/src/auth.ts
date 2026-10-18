/** The signed-in account, as returned by /api/auth/login, /register and /me. */
export type AuthUser = {
  id: number;
  username: string;
  email: string | null;
  isAdmin: boolean;
};

const TOKEN_KEY = 'pride_map_token';
const USER_KEY = 'pride_map_user';

export type StoredSession = { token: string; user: AuthUser };

export function getStoredSession(): StoredSession | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const rawUser = sessionStorage.getItem(USER_KEY);
  // A token without a user predates accounts; the server rejects those anyway.
  if (!token || !rawUser) return null;
  try {
    return { token, user: JSON.parse(rawUser) as AuthUser };
  } catch {
    return null;
  }
}

export function storeSession(session: StoredSession) {
  sessionStorage.setItem(TOKEN_KEY, session.token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearStoredSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}
