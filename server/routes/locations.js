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

    let idCategory = emptyToNull(req.body?.id_category ?? req.body?.categoryId ?? req.body?.idCategory);
    if (idCategory !== null) {
      const asNumber = Number(idCategory);
      if (!Number.isInteger(asNumber) || asNumber <= 0) {
        return res.status(400).json({ error: 'id_category must be a positive integer when provided' });
      }
      idCategory = asNumber;
    }

    const result = await pool.query(
      'INSERT INTO locations (name, description, address, latitude, longitude, url, id_category) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [name, description, address, latitude, longitude, url, idCategory]
    );

    return res.status(201).json({
      id: result.rows[0]?.id,
      name,
      description,
      address,
      latitude,
      longitude,
      url,
      id_category: idCategory,
    });
  } catch (error) {
    console.error('Error creating location:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;

