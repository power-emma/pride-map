const pool = require('./db');

/**
 * Looks up the account behind a token. Kept in its own module so the auth
 * middleware has a single data-access point (and tests can stub it without
 * disturbing the route queries).
 */
async function getUserById(id) {
  const result = await pool.query(
    'SELECT id, username, email, is_admin, password_changed_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] ?? null;
}

module.exports = { getUserById };
