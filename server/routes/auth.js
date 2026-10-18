const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { jwtSecret } = require('../secret');
const { requireAuth } = require('../middleware/auth');
const { createRateLimiter, rejectIfLimited } = require('../middleware/rateLimit');

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,32}$/;

// Postgres error code for a unique constraint violation (username race)
const UNIQUE_VIOLATION = '23505';

// No CAPTCHA, so cap how fast one IP can create accounts or file reset requests.
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });
const passwordRequestLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });

// Deliberately permissive email check — we only want to catch obvious typos,
// not reject valid-but-unusual addresses.
function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, jwtSecret, { expiresIn: '8h' });
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email ?? null,
    isAdmin: user.is_admin === true,
  };
}

// POST /auth/register  — body: { username, email, password }
router.post('/register', async (req, res) => {
  const ip = clientIp(req);
  if (rejectIfLimited(registerLimiter, ip, res, 'REGISTRATION_RATE_LIMIT')) return;

  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password = req.body?.password;

  if (!USERNAME_PATTERN.test(username)) {
    return res.status(400).json({ code: 'INVALID_USERNAME' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ code: 'A_VALID_EMAIL_REQUIRED' });
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ code: 'PASSWORD_TOO_SHORT' });
  }

  try {
    // Usernames are case-sensitive for login, but "Alex" and "alex" would be
    // too easy to confuse in the admin dashboard, so treat them as taken.
    const existing = await pool.query(
      'SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({ code: 'USERNAME_TAKEN' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, is_admin`,
      [username, email, passwordHash]
    );
    registerLimiter.record(ip);

    const user = result.rows[0];
    return res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return res.status(409).json({ code: 'USERNAME_TAKEN' });
    }
    console.error('Registration error:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /auth/login  — body: { username, password }
router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({ code: 'CREDENTIALS_REQUIRED' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, email, is_admin, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (result.rowCount === 0) {
      // Deliberate vague message to avoid username enumeration
      return res.status(401).json({ code: 'INVALID_CREDENTIALS' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS' });
    }

    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /auth/me — the signed-in account, so the client can restore a session.
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /auth/password-requests  — body: { username, new_password }
// Public, so it doubles as "forgot password". The change only applies once an
// admin approves it from the dashboard, after confirming with the account
// holder. Always answers the same way so it can't be used to probe usernames.
router.post('/password-requests', async (req, res) => {
  const ip = clientIp(req);
  if (rejectIfLimited(passwordRequestLimiter, ip, res, 'PASSWORD_REQUEST_RATE_LIMIT')) return;

  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const newPassword = req.body?.new_password;

  if (!username) {
    return res.status(400).json({ code: 'USERNAME_REQUIRED' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ code: 'PASSWORD_TOO_SHORT' });
  }

  try {
    // Hash before the lookup so the response time doesn't reveal whether the
    // username exists.
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const user = await pool.query('SELECT id FROM users WHERE username = $1', [username]);

    if (user.rowCount > 0) {
      const userId = user.rows[0].id;
      // Only the latest request per account is kept for review.
      await pool.query(
        `DELETE FROM password_change_requests WHERE user_id = $1 AND status = 'pending'`,
        [userId]
      );
      await pool.query(
        'INSERT INTO password_change_requests (user_id, password_hash) VALUES ($1, $2)',
        [userId, passwordHash]
      );
    }
    passwordRequestLimiter.record(ip);

    return res.status(202).json({ status: 'pending' });
  } catch (error) {
    console.error('Password change request error:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

module.exports = router;
