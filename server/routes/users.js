const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');

// Every account-management endpoint is admin only.
router.use(requireAdmin);

function parseId(value) {
  const id = parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /users — every account, newest first, with how much content each owns.
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         u.id, u.username, u.email, u.is_admin, u.created_at,
         (SELECT COUNT(*) FROM locations l WHERE l.owner_id = u.id)::int AS location_count,
         (SELECT COUNT(*) FROM events e WHERE e.owner_id = u.id)::int AS event_count,
         (SELECT COUNT(*) FROM submissions s WHERE s.user_id = u.id AND s.status = 'pending')::int AS pending_submission_count
       FROM users u
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /users/password-requests — the pending queue, oldest first.
router.get('/password-requests', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.user_id, u.username, u.email, r.created_at
       FROM password_change_requests r
       JOIN users u ON u.id = r.user_id
       WHERE r.status = 'pending'
       ORDER BY r.created_at ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching password change requests:', error);
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /users/password-requests/:id/approve — applies the requested password
// and signs the account out everywhere (see requireAuth).
router.post('/password-requests/:id/approve', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ code: 'INVALID_PASSWORD_REQUEST_ID' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const request = await client.query(
      `SELECT user_id, password_hash FROM password_change_requests
       WHERE id = $1 AND status = 'pending' FOR UPDATE`,
      [id]
    );
    if (request.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ code: 'PASSWORD_REQUEST_NOT_FOUND' });
    }

    const { user_id: userId, password_hash: passwordHash } = request.rows[0];
    await client.query(
      'UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    );
    await client.query(
      `UPDATE password_change_requests SET status = 'approved', reviewed_at = NOW() WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');
    return res.json({ id, status: 'approved' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error approving password change request:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  } finally {
    client.release();
  }
});

// POST /users/password-requests/:id/deny
router.post('/password-requests/:id/deny', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ code: 'INVALID_PASSWORD_REQUEST_ID' });
    }

    const result = await pool.query(
      `UPDATE password_change_requests SET status = 'denied', reviewed_at = NOW()
       WHERE id = $1 AND status = 'pending' RETURNING id`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ code: 'PASSWORD_REQUEST_NOT_FOUND' });
    }

    return res.json({ id, status: 'denied' });
  } catch (error) {
    console.error('Error denying password change request:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /users/:id[?content=delete] — removes the account and its pending
// submissions. Its live locations and events stay up (becoming admin-managed)
// unless ?content=delete, which removes them as well.
router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ code: 'INVALID_USER_ID' });
  }
  if (id === req.user.id) {
    return res.status(400).json({ code: 'CANNOT_DELETE_SELF' });
  }

  const deleteContent = req.query.content === 'delete';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (deleteContent) {
      await client.query('DELETE FROM events WHERE owner_id = $1', [id]);
      await client.query('DELETE FROM locations WHERE owner_id = $1', [id]);
    }

    const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ code: 'USER_NOT_FOUND' });
    }

    await client.query('COMMIT');
    return res.json({ deleted: id, contentDeleted: deleteContent });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error deleting user:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  } finally {
    client.release();
  }
});

module.exports = router;
