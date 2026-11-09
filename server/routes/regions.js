const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireAdmin, requireRegionalAdmin, canManageRegion } = require('../middleware/auth');

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseName(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM regions ORDER BY LOWER(name), id');
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching regions:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

router.get('/manage', requireRegionalAdmin, async (req, res) => {
  try {
    const result = req.user.isAdmin
      ? await pool.query('SELECT id, name FROM regions ORDER BY LOWER(name), id')
      : await pool.query(
        `SELECT r.id, r.name FROM regions r
         JOIN region_admins ra ON ra.region_id = r.id
         WHERE ra.user_id = $1 ORDER BY LOWER(r.name), r.id`,
        [req.user.id]
      );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching manageable regions:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  const name = parseName(req.body?.name);
  if (!name) return res.status(400).json({ code: 'REGION_NAME_REQUIRED' });
  try {
    const result = await pool.query(
      'INSERT INTO regions (name) VALUES ($1) RETURNING id, name',
      [name]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ code: 'REGION_NAME_TAKEN' });
    console.error('Error creating region:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

router.get('/:id/admins/search', requireRegionalAdmin, async (req, res) => {
  const regionId = parseId(req.params.id);
  const query = parseName(req.query.q);
  if (regionId === null) return res.status(400).json({ code: 'INVALID_REGION_ID' });
  if (!query || query.length < 2) return res.status(400).json({ code: 'ADMIN_SEARCH_QUERY_REQUIRED' });
  if (!canManageRegion(req.user, regionId)) return res.status(403).json({ code: 'REGION_ADMIN_REQUIRED' });
  try {
    const region = await pool.query('SELECT id FROM regions WHERE id = $1', [regionId]);
    if (region.rowCount === 0) return res.status(404).json({ code: 'REGION_NOT_FOUND' });
    const result = await pool.query(
      `SELECT u.id, u.username, u.email
       FROM users u
       WHERE POSITION(LOWER($2) IN LOWER(u.username)) > 0
         AND NOT EXISTS (
           SELECT 1 FROM region_admins ra
           WHERE ra.region_id = $1 AND ra.user_id = u.id
         )
       ORDER BY LOWER(u.username), u.id
       LIMIT 5`,
      [regionId, query]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error searching users for regional administrators:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

router.get('/:id/admins', requireRegionalAdmin, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const regionId = parseId(req.params.id);
  if (regionId === null) return res.status(400).json({ code: 'INVALID_REGION_ID' });
  if (!canManageRegion(req.user, regionId)) return res.status(403).json({ code: 'REGION_ADMIN_REQUIRED' });
  try {
    const region = await pool.query('SELECT id FROM regions WHERE id = $1', [regionId]);
    if (region.rowCount === 0) return res.status(404).json({ code: 'REGION_NOT_FOUND' });
    const result = await pool.query(
      `SELECT u.id, u.username, u.email
       FROM users u
       JOIN region_admins ra ON ra.user_id = u.id AND ra.region_id = $1
       ORDER BY LOWER(u.username), u.id`,
      [regionId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching regional administrators:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

router.post('/:id/admins/:userId', requireRegionalAdmin, async (req, res) => {
  const regionId = parseId(req.params.id);
  const userId = parseId(req.params.userId);
  if (regionId === null) return res.status(400).json({ code: 'INVALID_REGION_ID' });
  if (userId === null) return res.status(400).json({ code: 'INVALID_USER_ID' });
  if (!canManageRegion(req.user, regionId)) return res.status(403).json({ code: 'REGION_ADMIN_REQUIRED' });
  try {
    const result = await pool.query(
      `INSERT INTO region_admins (region_id, user_id)
       SELECT $1, id FROM users WHERE id = $2
       ON CONFLICT DO NOTHING RETURNING user_id`,
      [regionId, userId]
    );
    if (result.rowCount === 0) {
      const user = await pool.query('SELECT 1 FROM users WHERE id = $1', [userId]);
      if (user.rowCount === 0) return res.status(404).json({ code: 'USER_NOT_FOUND' });
      const region = await pool.query('SELECT 1 FROM regions WHERE id = $1', [regionId]);
      if (region.rowCount === 0) return res.status(404).json({ code: 'REGION_NOT_FOUND' });
    }
    return res.status(204).end();
  } catch (error) {
    console.error('Error assigning regional administrator:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

router.delete('/:id/admins/:userId', requireRegionalAdmin, async (req, res) => {
  const regionId = parseId(req.params.id);
  const userId = parseId(req.params.userId);
  if (regionId === null) return res.status(400).json({ code: 'INVALID_REGION_ID' });
  if (userId === null) return res.status(400).json({ code: 'INVALID_USER_ID' });
  if (!canManageRegion(req.user, regionId)) return res.status(403).json({ code: 'REGION_ADMIN_REQUIRED' });
  try {
    await pool.query(
      'DELETE FROM region_admins WHERE region_id = $1 AND user_id = $2 RETURNING user_id',
      [regionId, userId]
    );
    return res.status(204).end();
  } catch (error) {
    console.error('Error removing regional administrator:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

router.put('/:id', requireRegionalAdmin, async (req, res) => {
  const regionId = parseId(req.params.id);
  const name = parseName(req.body?.name);
  if (regionId === null) return res.status(400).json({ code: 'INVALID_REGION_ID' });
  if (!name) return res.status(400).json({ code: 'REGION_NAME_REQUIRED' });
  if (!canManageRegion(req.user, regionId)) return res.status(403).json({ code: 'REGION_ADMIN_REQUIRED' });
  try {
    const result = await pool.query(
      'UPDATE regions SET name = $1 WHERE id = $2 RETURNING id, name',
      [name, regionId]
    );
    if (result.rowCount === 0) return res.status(404).json({ code: 'REGION_NOT_FOUND' });
    return res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ code: 'REGION_NAME_TAKEN' });
    console.error('Error renaming region:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

router.delete('/:id', requireRegionalAdmin, async (req, res) => {
  const regionId = parseId(req.params.id);
  if (regionId === null) return res.status(400).json({ code: 'INVALID_REGION_ID' });
  if (!canManageRegion(req.user, regionId)) return res.status(403).json({ code: 'REGION_ADMIN_REQUIRED' });
  try {
    const result = await pool.query('DELETE FROM regions WHERE id = $1 RETURNING id', [regionId]);
    if (result.rowCount === 0) return res.status(404).json({ code: 'REGION_NOT_FOUND' });
    return res.json({ deleted: regionId });
  } catch (error) {
    console.error('Error deleting region:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

module.exports = router;
