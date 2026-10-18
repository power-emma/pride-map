const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireAdmin, ownershipFilter } = require('../middleware/auth');
const { createRateLimiter, rejectIfLimited } = require('../middleware/rateLimit');
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

// Generous per-account cap — enough for an organisation listing several
// spaces, low enough to stop a runaway script.
const submissionLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });

// Columns shared by every submission listing.
const SUBMISSION_COLUMNS = `
  s.id, s.name, s.name_fr, s.description, s.description_fr, s.address,
  s.latitude::float8 AS latitude, s.longitude::float8 AS longitude,
  s.url, s.image_url, (s.image_data IS NOT NULL) AS has_image,
  s.submitter_email, s.category_ids, s.status, s.created_at, s.reviewed_at`;

// ---------------------------------------------------------------------------
// POST /submissions  — any signed-in user, rate limited per account
// ---------------------------------------------------------------------------

router.post('/', requireAuth, async (req, res) => {
  try {
    if (rejectIfLimited(submissionLimiter, req.user.id, res, 'SUBMISSION_RATE_LIMIT')) return;

    // Validate fields.
    const name = emptyToNull(req.body?.name);
    const nameFr = emptyToNull(req.body?.name_fr);
    const submittedName = name || nameFr;
    if (!submittedName) {
      return res.status(400).json({ code: 'NAME_REQUIRED' });
    }

    const description = emptyToNull(req.body?.description);
    const descriptionFr = emptyToNull(req.body?.description_fr);
    const address = emptyToNull(req.body?.address);
    const url = emptyToNull(req.body?.url);
    const imageUrl = emptyToNull(req.body?.image_url);

    const latitude = parseNullableFloat(req.body?.latitude);
    const longitude = parseNullableFloat(req.body?.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return res.status(400).json({ code: 'INVALID_COORDINATES' });
    }
    if (latitude !== null && (latitude < -90 || latitude > 90)) {
      return res.status(400).json({ code: 'INVALID_LATITUDE' });
    }
    if (longitude !== null && (longitude < -180 || longitude > 180)) {
      return res.status(400).json({ code: 'INVALID_LONGITUDE' });
    }

    const categoryIds = parseCategoryIds(req.body?.category_ids);
    if (categoryIds === null) {
      return res.status(400).json({ code: 'INVALID_CATEGORIES' });
    }

    // Persist as a pending submission. The contact email is a snapshot of the
    // account's, so admins can still reach the submitter if it changes later.
    const result = await pool.query(
      `INSERT INTO submissions
         (name, name_fr, description, description_fr, address, latitude, longitude, url, image_url, submitter_email, category_ids, user_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
       RETURNING id`,
      [submittedName, nameFr, description, descriptionFr, address, latitude, longitude, url, imageUrl, req.user.email, categoryIds, req.user.id]
    );

    submissionLimiter.record(req.user.id);

    return res.status(201).json({
      id: result.rows[0]?.id,
      status: 'pending',
      message: 'Thank you! Your submission is pending admin approval.',
    });
  } catch (error) {
    console.error('Error creating submission:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// ---------------------------------------------------------------------------
// GET /submissions  — admin only. Lists the pending queue by default.
// Pass ?status=approved|rejected|all to see others.
// ---------------------------------------------------------------------------

router.get('/', requireAdmin, async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    if (!['pending', 'approved', 'rejected', 'all'].includes(status)) {
      return res.status(400).json({ code: 'INVALID_STATUS_FILTER' });
    }

    const params = [];
    let where = '';
    if (status !== 'all') {
      params.push(status);
      where = 'WHERE s.status = $1';
    }

    const result = await pool.query(
      `SELECT ${SUBMISSION_COLUMNS}, u.username AS submitter_username
       FROM submissions s
       LEFT JOIN users u ON u.id = s.user_id
       ${where}
       ORDER BY s.created_at DESC`,
      params
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// ---------------------------------------------------------------------------
// GET /submissions/mine  — the signed-in user's own submissions, any status,
// so they can follow what is still awaiting review.
// ---------------------------------------------------------------------------

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${SUBMISSION_COLUMNS}
       FROM submissions s
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching own submissions:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// ---------------------------------------------------------------------------
// PUT /submissions/:id  — its submitter or an admin. Edit a pending
// submission in place (e.g. fix typos or add coordinates) before it is
// approved. Only pending submissions can be edited, and only admins can change
// the contact email (it is omitted or left blank to keep the current one).
// ---------------------------------------------------------------------------

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_SUBMISSION_ID' });
    }

    const name = emptyToNull(req.body?.name);
    const nameFr = emptyToNull(req.body?.name_fr);
    const submittedName = name || nameFr;
    if (!submittedName) {
      return res.status(400).json({ code: 'NAME_REQUIRED' });
    }

    const submitterEmail = req.user.isAdmin ? emptyToNull(req.body?.submitter_email) : null;
    if (submitterEmail !== null && !isValidEmail(submitterEmail)) {
      return res.status(400).json({ code: 'A_VALID_EMAIL_REQUIRED' });
    }

    const description = emptyToNull(req.body?.description);
    const descriptionFr = emptyToNull(req.body?.description_fr);
    const address = emptyToNull(req.body?.address);
    const url = emptyToNull(req.body?.url);
    const imageUrl = emptyToNull(req.body?.image_url);

    const latitude = parseNullableFloat(req.body?.latitude);
    const longitude = parseNullableFloat(req.body?.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return res.status(400).json({ code: 'INVALID_COORDINATES' });
    }
    if (latitude !== null && (latitude < -90 || latitude > 90)) {
      return res.status(400).json({ code: 'INVALID_LATITUDE' });
    }
    if (longitude !== null && (longitude < -180 || longitude > 180)) {
      return res.status(400).json({ code: 'INVALID_LONGITUDE' });
    }

    const categoryIds = parseCategoryIds(req.body?.category_ids);
    if (categoryIds === null) {
      return res.status(400).json({ code: 'INVALID_CATEGORIES' });
    }

    const params = [submittedName, nameFr, description, descriptionFr, address, latitude, longitude, url, imageUrl, submitterEmail?.trim() ?? null, categoryIds, id];
    const result = await pool.query(
      `UPDATE submissions
         SET name = $1, name_fr = $2, description = $3, description_fr = $4,
             address = $5, latitude = $6, longitude = $7, url = $8,
             image_url = $9, submitter_email = COALESCE($10, submitter_email), category_ids = $11
       WHERE id = $12 AND status = 'pending'${ownershipFilter(req.user, params, 'user_id')}
       RETURNING id, name, name_fr, description, description_fr, address,
                 latitude::float8 AS latitude, longitude::float8 AS longitude,
                 url, image_url, submitter_email, category_ids, status, created_at`,
      params
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 'PENDING_SUBMISSION_NOT_FOUND' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating submission:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /submissions/:id  — its submitter or an admin. Withdraws a submission
// that is still awaiting review.
// ---------------------------------------------------------------------------

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_SUBMISSION_ID' });
    }

    const params = [id];
    const result = await pool.query(
      `DELETE FROM submissions WHERE id = $1 AND status = 'pending'${ownershipFilter(req.user, params, 'user_id')} RETURNING id`,
      params
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ code: 'PENDING_SUBMISSION_NOT_FOUND' });
    }

    return res.json({ deleted: id });
  } catch (error) {
    console.error('Error withdrawing submission:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// ---------------------------------------------------------------------------
// POST /submissions/:id/approve  — admin only.
// Copies the submission into `locations` (+ category links), owned by the
// submitter, and marks it approved. Returns the newly created location id.
// ---------------------------------------------------------------------------

router.post('/:id/approve', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_SUBMISSION_ID' });
    }

    await client.query('BEGIN');

    const sub = await client.query(
      `SELECT name, name_fr, description, description_fr, address, latitude, longitude, url, image_url,
              image_data, image_mime_type, category_ids, user_id, status
       FROM submissions WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (sub.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ code: 'SUBMISSION_NOT_FOUND' });
    }
    if (sub.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ code: 'INVALID_SUBMISSION_STATUS' });
    }

    const s = sub.rows[0];

    const loc = await client.query(
      `INSERT INTO locations (name, name_fr, description, description_fr, address, latitude, longitude, url, image_url, image_data, image_mime_type, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [s.name, s.name_fr, s.description, s.description_fr, s.address, s.latitude, s.longitude, s.url, s.image_url, s.image_data, s.image_mime_type, s.user_id]
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
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// POST /submissions/:id/reject  — admin only.
// ---------------------------------------------------------------------------

router.post('/:id/reject', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_SUBMISSION_ID' });
    }

    const result = await pool.query(
      `UPDATE submissions SET status = 'rejected', reviewed_at = NOW()
       WHERE id = $1 AND status = 'pending' RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 'PENDING_SUBMISSION_NOT_FOUND' });
    }

    return res.json({ id, status: 'rejected' });
  } catch (error) {
    console.error('Error rejecting submission:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// Admins may touch any submission; submitters only their own pending ones.
function pendingOwnFilter(user, params) {
  if (user.isAdmin) return '';
  return ` AND status = 'pending'${ownershipFilter(user, params, 'user_id')}`;
}

// GET /submissions/:id/image — public. Same sensitivity as the photo itself
// becoming public once the submission is approved; only submitter_email is
// gated, and this endpoint doesn't expose it.
router.get('/:id/image', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_SUBMISSION_ID' });
    }

    const result = await pool.query(
      'SELECT image_data, image_mime_type FROM submissions WHERE id = $1',
      [id]
    );
    const row = result.rows[0];
    if (!row || !row.image_data) {
      return res.status(404).json({ code: 'NO_SUBMISSION_IMAGE' });
    }

    res.set('Content-Type', row.image_mime_type || 'application/octet-stream');
    res.set('Cache-Control', 'private, max-age=3600');
    return res.send(row.image_data);
  } catch (error) {
    console.error('Error serving submission image:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /submissions/:id/image — submitter or admin. Attach/replace a photo on
// a submission; submitters can only change their own while it is pending.
router.post('/:id/image', requireAuth, handleImageUpload, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_SUBMISSION_ID' });
    }

    const params = [req.file.buffer, req.file.mimetype, id];
    const result = await pool.query(
      `UPDATE submissions SET image_data = $1, image_mime_type = $2
       WHERE id = $3${pendingOwnFilter(req.user, params)} RETURNING id`,
      params
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ code: 'SUBMISSION_NOT_FOUND' });
    }

    return res.json({ id, has_image: true });
  } catch (error) {
    console.error('Error uploading submission image:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /submissions/:id/image — submitter (while pending) or admin.
router.delete('/:id/image', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_SUBMISSION_ID' });
    }

    const params = [id];
    const result = await pool.query(
      `UPDATE submissions SET image_data = NULL, image_mime_type = NULL
       WHERE id = $1${pendingOwnFilter(req.user, params)} RETURNING id`,
      params
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ code: 'SUBMISSION_NOT_FOUND' });
    }

    return res.json({ id, has_image: false });
  } catch (error) {
    console.error('Error deleting submission image:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

module.exports = router;
