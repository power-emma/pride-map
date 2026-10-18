const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireAdmin, ownershipFilter } = require('../middleware/auth');
const { handleImageUpload } = require('../middleware/upload');

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

// Every location with its categories, optionally narrowed by a WHERE clause.
function selectLocations(where = '', params = []) {
  return pool.query(`
      SELECT
        l.id,
        l.name,
        l.name_fr,
        l.description,
        l.description_fr,
        l.address,
        l.latitude::float8 AS latitude,
        l.longitude::float8 AS longitude,
        l.url,
        l.image_url,
        (l.image_data IS NOT NULL) AS has_image,
        COALESCE(
          ARRAY_AGG(lc.id_category ORDER BY lc.id_category) FILTER (WHERE lc.id_category IS NOT NULL),
          '{}'
        ) AS category_ids
      FROM locations l
      LEFT JOIN location_categories lc ON lc.id_location = l.id
      ${where}
      GROUP BY l.id, l.name, l.name_fr, l.description, l.description_fr, l.address, l.latitude, l.longitude, l.url, l.image_url
      ORDER BY l.name
    `, params);
}

// GET all locations with their categories
router.get('/', async (req, res) => {
  try {
    const result = await selectLocations();
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /locations/mine — the signed-in user's own live locations.
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const result = await selectLocations('WHERE l.owner_id = $1', [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching own locations:', error);
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// Helper: parse and validate an array of category ids from the request body
function parseCategoryIds(raw) {
  const arr = Array.isArray(raw) ? raw : (raw == null ? [] : [raw]);
  const ids = arr.map(v => Number(v));
  if (ids.some(n => !Number.isInteger(n) || n <= 0)) return null;
  return ids;
}

// PUT update an existing location — its owner or an admin
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_LOCATION_ID' });
    }

    const name = emptyToNull(req.body?.name);
    if (!name) {
      return res.status(400).json({ code: 'NAME_REQUIRED' });
    }

    const description = emptyToNull(req.body?.description);
    const nameFr = emptyToNull(req.body?.name_fr);
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

    const params = [name, nameFr, description, descriptionFr, address, latitude, longitude, url, imageUrl, id];
    const result = await pool.query(
      `UPDATE locations SET name=$1, name_fr=$2, description=$3, description_fr=$4, address=$5, latitude=$6, longitude=$7, url=$8, image_url=$9
       WHERE id=$10${ownershipFilter(req.user, params)} RETURNING id`,
      params
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 'LOCATION_NOT_FOUND' });
    }

    // Replace all categories
    await pool.query('DELETE FROM location_categories WHERE id_location = $1', [id]);
    for (const catId of categoryIds) {
      await pool.query(
        'INSERT INTO location_categories (id_location, id_category) VALUES ($1, $2)',
        [id, catId]
      );
    }

    return res.json({ id, name, name_fr: nameFr, description, description_fr: descriptionFr, address, latitude, longitude, url, image_url: imageUrl, category_ids: categoryIds });
  } catch (error) {
    console.error('Error updating location:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE a location — its owner or an admin
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_LOCATION_ID' });
    }

    const params = [id];
    const result = await pool.query(
      `DELETE FROM locations WHERE id = $1${ownershipFilter(req.user, params)} RETURNING id`,
      params
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ code: 'LOCATION_NOT_FOUND' });
    }

    return res.json({ deleted: id });
  } catch (error) {
    console.error('Error deleting location:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST a new live location — admin only. Everyone else goes through the
// /submissions approval queue.
router.post('/', requireAdmin, async (req, res) => {
  try {
    const name = emptyToNull(req.body?.name);
    if (!name) {
      return res.status(400).json({ code: 'NAME_REQUIRED' });
    }

    const description = emptyToNull(req.body?.description);
    const nameFr = emptyToNull(req.body?.name_fr);
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

    const result = await pool.query(
      'INSERT INTO locations (name, name_fr, description, description_fr, address, latitude, longitude, url, image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [name, nameFr, description, descriptionFr, address, latitude, longitude, url, imageUrl]
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
      name_fr: nameFr,
      description,
      description_fr: descriptionFr,
      address,
      latitude,
      longitude,
      url,
      image_url: imageUrl,
      category_ids: categoryIds,
    });
  } catch (error) {
    console.error('Error creating location:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /locations/:id/image — public. Serves the uploaded BLOB, if any.
router.get('/:id/image', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_LOCATION_ID' });
    }

    const result = await pool.query(
      'SELECT image_data, image_mime_type FROM locations WHERE id = $1',
      [id]
    );
    const row = result.rows[0];
    if (!row || !row.image_data) {
      return res.status(404).json({ code: 'NO_LOCATION_IMAGE' });
    }

    res.set('Content-Type', row.image_mime_type || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=3600');
    return res.send(row.image_data);
  } catch (error) {
    console.error('Error serving location image:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /locations/:id/image — owner or admin. Uploads (replacing) the image BLOB.
router.post('/:id/image', requireAuth, handleImageUpload, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_LOCATION_ID' });
    }

    const params = [req.file.buffer, req.file.mimetype, id];
    const result = await pool.query(
      `UPDATE locations SET image_data = $1, image_mime_type = $2 WHERE id = $3${ownershipFilter(req.user, params)} RETURNING id`,
      params
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ code: 'LOCATION_NOT_FOUND' });
    }

    return res.json({ id, has_image: true });
  } catch (error) {
    console.error('Error uploading location image:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /locations/:id/image — owner or admin. Clears the uploaded BLOB.
router.delete('/:id/image', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_LOCATION_ID' });
    }

    const params = [id];
    const result = await pool.query(
      `UPDATE locations SET image_data = NULL, image_mime_type = NULL WHERE id = $1${ownershipFilter(req.user, params)} RETURNING id`,
      params
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ code: 'LOCATION_NOT_FOUND' });
    }

    return res.json({ id, has_image: false });
  } catch (error) {
    console.error('Error deleting location image:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

module.exports = router;
