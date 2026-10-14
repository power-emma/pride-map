const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { turnstileSecret } = require('../config');
const { handleImageUpload } = require('../middleware/upload');

// ---------------------------------------------------------------------------
// Validation helpers (mirrors the ones in routes/locations.js)
// ---------------------------------------------------------------------------

function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

function parseNullableFloat(value) {
  const normalized = emptyToNull(value);
  if (normalized === null) return null;
  const num = typeof normalized === 'number' ? normalized : Number(normalized);
  if (!Number.isFinite(num)) return NaN;
  return num;
}

// Parse an array of positive-integer category ids; returns null if malformed.
function parseCategoryIds(raw) {
  const arr = Array.isArray(raw) ? raw : (raw == null ? [] : [raw]);
  const ids = arr.map((v) => Number(v));
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) return null;
  return ids;
}

// Deliberately permissive email check — we only want to catch obvious typos,
// not reject valid-but-unusual addresses.
function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// ---------------------------------------------------------------------------
// In-memory rate limiter: one submission per IP per RATE_LIMIT_MS.
// Resets on server restart (by design — see the chosen tracking approach).
// ---------------------------------------------------------------------------

const RATE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes
const lastSubmissionByIp = new Map(); // ip -> epoch ms of last accepted submission

// Occasionally drop stale entries so the map doesn't grow unbounded.
function pruneRateLimitMap(now) {
  if (lastSubmissionByIp.size < 1000) return;
  for (const [ip, ts] of lastSubmissionByIp) {
    if (now - ts > RATE_LIMIT_MS) lastSubmissionByIp.delete(ip);
  }
}

// ---------------------------------------------------------------------------
// Cloudflare Turnstile verification
// ---------------------------------------------------------------------------

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyTurnstile(token, remoteip) {
  if (!token || typeof token !== 'string') return false;

  const body = new URLSearchParams();
  body.append('secret', turnstileSecret);
  body.append('response', token);
  if (remoteip) body.append('remoteip', remoteip);

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    return data.success === true;
  } catch (error) {
    console.error('Turnstile verification request failed:', error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// POST /submissions  — public, CAPTCHA-protected, rate limited
// ---------------------------------------------------------------------------

router.post('/', async (req, res) => {
  try {
    const now = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';

    // 1) Rate limit before doing any real work.
    const last = lastSubmissionByIp.get(ip);
    if (last && now - last < RATE_LIMIT_MS) {
      const retryAfterSec = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: 'You can only submit one business every 10 minutes. Please try again later.',
        retryAfterSeconds: retryAfterSec,
      });
    }

    // 2) CAPTCHA.
    const captchaToken = req.body?.captchaToken;
    const captchaOk = await verifyTurnstile(captchaToken, ip);
    if (!captchaOk) {
      return res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.' });
    }

    // 3) Validate fields.
    const name = emptyToNull(req.body?.name);
    const nameFr = emptyToNull(req.body?.name_fr);
    const submittedName = name || nameFr;
    if (!submittedName) {
      return res.status(400).json({ error: 'name is required' });
    }

    const submitterEmail = emptyToNull(req.body?.submitter_email);
    if (!submitterEmail || !isValidEmail(submitterEmail)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const description = emptyToNull(req.body?.description);
    const descriptionFr = emptyToNull(req.body?.description_fr);
    const address = emptyToNull(req.body?.address);
    const url = emptyToNull(req.body?.url);
    const imageUrl = emptyToNull(req.body?.image_url);

    const latitude = parseNullableFloat(req.body?.latitude);
    const longitude = parseNullableFloat(req.body?.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return res.status(400).json({ error: 'latitude/longitude must be numbers when provided' });
    }
    if (latitude !== null && (latitude < -90 || latitude > 90)) {
      return res.status(400).json({ error: 'latitude must be between -90 and 90' });
    }
    if (longitude !== null && (longitude < -180 || longitude > 180)) {
      return res.status(400).json({ error: 'longitude must be between -180 and 180' });
    }

    const categoryIds = parseCategoryIds(req.body?.category_ids);
    if (categoryIds === null) {
      return res.status(400).json({ error: 'category_ids must be an array of positive integers' });
    }

    // 4) Persist as a pending submission.
    const result = await pool.query(
      `INSERT INTO submissions
         (name, name_fr, description, description_fr, address, latitude, longitude, url, image_url, submitter_email, category_ids, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
       RETURNING id`,
      [submittedName, nameFr, description, descriptionFr, address, latitude, longitude, url, imageUrl, submitterEmail.trim(), categoryIds]
    );

    // 5) Record the successful submission for rate limiting.
    lastSubmissionByIp.set(ip, now);
    pruneRateLimitMap(now);

    return res.status(201).json({
      id: result.rows[0]?.id,
      status: 'pending',
      message: 'Thank you! Your submission is pending admin approval.',
    });
  } catch (error) {
    console.error('Error creating submission:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------------------------------------------------------------------------
// GET /submissions  — admin only. Lists the pending queue by default.
// Pass ?status=approved|rejected|all to see others.
// ---------------------------------------------------------------------------

router.get('/', requireAuth, async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';

    let result;
    if (status === 'all') {
      result = await pool.query(
        `SELECT id, name, name_fr, description, description_fr, address,
                latitude::float8 AS latitude, longitude::float8 AS longitude,
                url, image_url, (image_data IS NOT NULL) AS has_image,
                submitter_email, category_ids, status, created_at, reviewed_at
         FROM submissions
         ORDER BY created_at DESC`
      );
    } else {
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
      result = await pool.query(
        `SELECT id, name, name_fr, description, description_fr, address,
                latitude::float8 AS latitude, longitude::float8 AS longitude,
                url, image_url, (image_data IS NOT NULL) AS has_image,
                submitter_email, category_ids, status, created_at, reviewed_at
         FROM submissions
         WHERE status = $1
         ORDER BY created_at DESC`,
        [status]
      );
    }

    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /submissions/:id  — admin only. Edit a pending submission in place
// (e.g. fix typos or add coordinates) before approving it. Only pending
// submissions can be edited.
// ---------------------------------------------------------------------------

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid submission id' });
    }

    const name = emptyToNull(req.body?.name);
    const nameFr = emptyToNull(req.body?.name_fr);
    const submittedName = name || nameFr;
    if (!submittedName) {
      return res.status(400).json({ error: 'name is required' });
    }

    const submitterEmail = emptyToNull(req.body?.submitter_email);
    if (!submitterEmail || !isValidEmail(submitterEmail)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const description = emptyToNull(req.body?.description);
    const descriptionFr = emptyToNull(req.body?.description_fr);
    const address = emptyToNull(req.body?.address);
    const url = emptyToNull(req.body?.url);
    const imageUrl = emptyToNull(req.body?.image_url);

    const latitude = parseNullableFloat(req.body?.latitude);
    const longitude = parseNullableFloat(req.body?.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return res.status(400).json({ error: 'latitude/longitude must be numbers when provided' });
    }
    if (latitude !== null && (latitude < -90 || latitude > 90)) {
      return res.status(400).json({ error: 'latitude must be between -90 and 90' });
    }
    if (longitude !== null && (longitude < -180 || longitude > 180)) {
      return res.status(400).json({ error: 'longitude must be between -180 and 180' });
    }

    const categoryIds = parseCategoryIds(req.body?.category_ids);
    if (categoryIds === null) {
      return res.status(400).json({ error: 'category_ids must be an array of positive integers' });
    }

    const result = await pool.query(
      `UPDATE submissions
         SET name = $1, name_fr = $2, description = $3, description_fr = $4,
             address = $5, latitude = $6, longitude = $7, url = $8,
             image_url = $9, submitter_email = $10, category_ids = $11
       WHERE id = $12 AND status = 'pending'
       RETURNING id, name, name_fr, description, description_fr, address,
                 latitude::float8 AS latitude, longitude::float8 AS longitude,
                 url, image_url, submitter_email, category_ids, status, created_at`,
      [submittedName, nameFr, description, descriptionFr, address, latitude, longitude, url, imageUrl, submitterEmail.trim(), categoryIds, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Pending submission not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating submission:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------------------------------------------------------------------------
// POST /submissions/:id/approve  — admin only.
// Copies the submission into `locations` (+ category links) and marks it
// approved. Returns the newly created location id.
// ---------------------------------------------------------------------------

router.post('/:id/approve', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid submission id' });
    }

    await client.query('BEGIN');

    const sub = await client.query(
      `SELECT name, name_fr, description, description_fr, address, latitude, longitude, url, image_url,
              image_data, image_mime_type, category_ids, status
       FROM submissions WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (sub.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Submission not found' });
    }
    if (sub.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Submission already ${sub.rows[0].status}` });
    }

    const s = sub.rows[0];

    const loc = await client.query(
      `INSERT INTO locations (name, name_fr, description, description_fr, address, latitude, longitude, url, image_url, image_data, image_mime_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [s.name, s.name_fr, s.description, s.description_fr, s.address, s.latitude, s.longitude, s.url, s.image_url, s.image_data, s.image_mime_type]
    );
    const locationId = loc.rows[0].id;

    for (const catId of s.category_ids || []) {
      await client.query(
        `INSERT INTO location_categories (id_location, id_category)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [locationId, catId]
      );
    }

    await client.query(
      `UPDATE submissions SET status = 'approved', reviewed_at = NOW() WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');

    return res.json({ id, status: 'approved', locationId });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error approving submission:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// POST /submissions/:id/reject  — admin only.
// ---------------------------------------------------------------------------

router.post('/:id/reject', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid submission id' });
    }

    const result = await pool.query(
      `UPDATE submissions SET status = 'rejected', reviewed_at = NOW()
       WHERE id = $1 AND status = 'pending' RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Pending submission not found' });
    }

    return res.json({ id, status: 'rejected' });
  } catch (error) {
    console.error('Error rejecting submission:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /submissions/:id/image — public. Same sensitivity as the photo itself
// becoming public once the submission is approved; only submitter_email is
// gated, and this endpoint doesn't expose it.
router.get('/:id/image', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid submission id' });
    }

    const result = await pool.query(
      'SELECT image_data, image_mime_type FROM submissions WHERE id = $1',
      [id]
    );
    const row = result.rows[0];
    if (!row || !row.image_data) {
      return res.status(404).json({ error: 'No image uploaded for this submission' });
    }

    res.set('Content-Type', row.image_mime_type || 'application/octet-stream');
    res.set('Cache-Control', 'private, max-age=3600');
    return res.send(row.image_data);
  } catch (error) {
    console.error('Error serving submission image:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /submissions/:id/image — admin only. Attach/replace a photo while
// reviewing a pending submission, before approving it.
router.post('/:id/image', requireAuth, handleImageUpload, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid submission id' });
    }

    const result = await pool.query(
      'UPDATE submissions SET image_data = $1, image_mime_type = $2 WHERE id = $3 RETURNING id',
      [req.file.buffer, req.file.mimetype, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    return res.json({ id, has_image: true });
  } catch (error) {
    console.error('Error uploading submission image:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /submissions/:id/image — admin only.
router.delete('/:id/image', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid submission id' });
    }

    const result = await pool.query(
      'UPDATE submissions SET image_data = NULL, image_mime_type = NULL WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    return res.json({ id, has_image: false });
  } catch (error) {
    console.error('Error deleting submission image:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
