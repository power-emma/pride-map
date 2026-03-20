const express = require('express');
const router = express.Router();
const pool = require('../db');

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

// GET all locations with their categories
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        l.id,
        l.name,
        l.description,
        l.address,
        l.latitude::float8 AS latitude,
        l.longitude::float8 AS longitude,
        l.url,
        COALESCE(
          ARRAY_AGG(lc.id_category ORDER BY lc.id_category) FILTER (WHERE lc.id_category IS NOT NULL),
          '{}'
        ) AS category_ids
      FROM locations l
      LEFT JOIN location_categories lc ON lc.id_location = l.id
      GROUP BY l.id, l.name, l.description, l.address, l.latitude, l.longitude, l.url
      ORDER BY l.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Helper: parse and validate an array of category ids from the request body
function parseCategoryIds(raw) {
  const arr = Array.isArray(raw) ? raw : (raw == null ? [] : [raw]);
  const ids = arr.map(v => Number(v));
  if (ids.some(n => !Number.isInteger(n) || n <= 0)) return null;
  return ids;
}

// PUT update an existing location
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid location id' });
    }

    const name = emptyToNull(req.body?.name);
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const description = emptyToNull(req.body?.description);
    const address = emptyToNull(req.body?.address);
    const url = emptyToNull(req.body?.url);

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
      'UPDATE locations SET name=$1, description=$2, address=$3, latitude=$4, longitude=$5, url=$6 WHERE id=$7 RETURNING id',
      [name, description, address, latitude, longitude, url, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Replace all categories
    await pool.query('DELETE FROM location_categories WHERE id_location = $1', [id]);
    for (const catId of categoryIds) {
      await pool.query(
        'INSERT INTO location_categories (id_location, id_category) VALUES ($1, $2)',
        [id, catId]
      );
    }

    return res.json({ id, name, description, address, latitude, longitude, url, category_ids: categoryIds });
  } catch (error) {
    console.error('Error updating location:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE a location
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid location id' });
    }

    const result = await pool.query('DELETE FROM locations WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    return res.json({ deleted: id });
  } catch (error) {
    console.error('Error deleting location:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const name = emptyToNull(req.body?.name);
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const description = emptyToNull(req.body?.description);
    const address = emptyToNull(req.body?.address);
    const url = emptyToNull(req.body?.url);

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
      'INSERT INTO locations (name, description, address, latitude, longitude, url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [name, description, address, latitude, longitude, url]
    );

    const locationId = result.rows[0]?.id;

    for (const catId of categoryIds) {
      await pool.query(
        'INSERT INTO location_categories (id_location, id_category) VALUES ($1, $2)',
        [locationId, catId]
      );
    }

    return res.status(201).json({
      id: locationId,
      name,
      description,
      address,
      latitude,
      longitude,
      url,
      category_ids: categoryIds,
    });
  } catch (error) {
    console.error('Error creating location:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;

