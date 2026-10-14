const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { handleImageUpload } = require('../middleware/upload');

function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

// Postgres error code for a foreign key violation (e.g. an unknown location_id)
const FOREIGN_KEY_VIOLATION = '23503';

function parseNullableId(value) {
  const normalized = emptyToNull(value);
  if (normalized === null) return null;
  const num = Number(normalized);
  if (!Number.isInteger(num) || num <= 0) return NaN;
  return num;
}

// GET /events — public. Upcoming events only, soonest first. Falls back to
// the linked business's image when the event doesn't have its own, so the
// client never needs to know about the location relationship.
// Optional ?limit=N and ?city=Name to narrow the results.
router.get('/', async (req, res) => {
  try {
    const city = emptyToNull(req.query.city);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 50);

    const params = [];
    let where = 'WHERE e.event_date >= CURRENT_DATE';
    if (city) {
      params.push(city);
      where += ` AND e.city = $${params.length}`;
    }
    params.push(limit);

    const result = await pool.query(
      `SELECT
         e.id, e.title, e.title_fr, e.description, e.description_fr, e.event_date, e.event_time,
         e.location, e.city, e.url,
         CASE
           WHEN e.image_data IS NOT NULL THEN '/api/events/' || e.id || '/image'
           WHEN e.image_url IS NOT NULL THEN e.image_url
           WHEN l.image_data IS NOT NULL THEN '/api/locations/' || l.id || '/image'
           ELSE l.image_url
         END AS image_url
       FROM events e
       LEFT JOIN locations l ON l.id = e.location_id
       ${where}
       ORDER BY e.event_date ASC, e.event_time ASC NULLS LAST
       LIMIT $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /events/all — admin only. Every event, most recent first, for
// management. Includes the raw (unresolved) image_url plus the linked
// business's name/image so the admin UI can show what it would fall back to.
router.get('/all', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         e.id, e.title, e.title_fr, e.description, e.description_fr, e.event_date, e.event_time,
         e.location, e.location_id, e.city, e.url, e.image_url, e.created_at,
         (e.image_data IS NOT NULL) AS has_image,
         l.name AS location_name, l.image_url AS location_image_url,
         (l.image_data IS NOT NULL) AS location_has_image
       FROM events e
       LEFT JOIN locations l ON l.id = e.location_id
       ORDER BY e.event_date DESC, e.event_time DESC NULLS LAST`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all events:', error);
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

function validateEventBody(body) {
  const title = emptyToNull(body?.title);
  const titleFr = emptyToNull(body?.title_fr);
  const displayTitle = title || titleFr;
  if (!displayTitle) return { code: 'TITLE_REQUIRED' };

  const eventDate = emptyToNull(body?.event_date);
  if (!eventDate || Number.isNaN(Date.parse(eventDate))) {
    return { code: 'INVALID_EVENT_DATE' };
  }

  const locationId = parseNullableId(body?.location_id);
  if (Number.isNaN(locationId)) {
    return { code: 'INVALID_LINKED_LOCATION' };
  }

  const eventTime = emptyToNull(body?.event_time);
  const description = emptyToNull(body?.description);
  const descriptionFr = emptyToNull(body?.description_fr);
  const location = emptyToNull(body?.location);
  const url = emptyToNull(body?.url);
  const imageUrl = emptyToNull(body?.image_url);
  const city = emptyToNull(body?.city) || 'Ottawa';

  return { value: { title: displayTitle, titleFr, description, descriptionFr, eventDate, eventTime, location, locationId, city, url, imageUrl } };
}

// POST /events — admin only.
router.post('/', requireAuth, async (req, res) => {
  try {
    const { code, value } = validateEventBody(req.body);
    if (code) return res.status(400).json({ code });

    const result = await pool.query(
      `INSERT INTO events (title, title_fr, description, description_fr, event_date, event_time, location, location_id, city, url, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, title, title_fr, description, description_fr, event_date, event_time, location, location_id, city, url, image_url, created_at`,
      [value.title, value.titleFr, value.description, value.descriptionFr, value.eventDate, value.eventTime, value.location, value.locationId, value.city, value.url, value.imageUrl]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return res.status(400).json({ code: 'LINKED_LOCATION_NOT_FOUND' });
    }
    console.error('Error creating event:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// PUT /events/:id — admin only.
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_EVENT_ID' });
    }

    const { code, value } = validateEventBody(req.body);
    if (code) return res.status(400).json({ code });

    const result = await pool.query(
      `UPDATE events
         SET title=$1, title_fr=$2, description=$3, description_fr=$4,
             event_date=$5, event_time=$6, location=$7, location_id=$8,
             city=$9, url=$10, image_url=$11
       WHERE id=$12
       RETURNING id, title, title_fr, description, description_fr, event_date, event_time, location, location_id, city, url, image_url, created_at`,
      [value.title, value.titleFr, value.description, value.descriptionFr, value.eventDate, value.eventTime, value.location, value.locationId, value.city, value.url, value.imageUrl, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 'EVENT_NOT_FOUND' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return res.status(400).json({ code: 'LINKED_LOCATION_NOT_FOUND' });
    }
    console.error('Error updating event:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /events/:id — admin only.
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_EVENT_ID' });
    }

    const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ code: 'EVENT_NOT_FOUND' });
    }

    return res.json({ deleted: id });
  } catch (error) {
    console.error('Error deleting event:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /events/:id/image — public. Serves the event's own uploaded BLOB, if any
// (this does not fall back to the linked location's image — the resolved
// image_url returned by GET / already points straight at whichever one wins).
router.get('/:id/image', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_EVENT_ID' });
    }

    const result = await pool.query(
      'SELECT image_data, image_mime_type FROM events WHERE id = $1',
      [id]
    );
    const row = result.rows[0];
    if (!row || !row.image_data) {
      return res.status(404).json({ code: 'NO_EVENT_IMAGE' });
    }

    res.set('Content-Type', row.image_mime_type || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=3600');
    return res.send(row.image_data);
  } catch (error) {
    console.error('Error serving event image:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /events/:id/image — admin only. Uploads (replacing) the image BLOB.
router.post('/:id/image', requireAuth, handleImageUpload, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_EVENT_ID' });
    }

    const result = await pool.query(
      'UPDATE events SET image_data = $1, image_mime_type = $2 WHERE id = $3 RETURNING id',
      [req.file.buffer, req.file.mimetype, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ code: 'EVENT_NOT_FOUND' });
    }

    return res.json({ id, has_image: true });
  } catch (error) {
    console.error('Error uploading event image:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /events/:id/image — admin only. Clears the uploaded BLOB.
router.delete('/:id/image', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 'INVALID_EVENT_ID' });
    }

    const result = await pool.query(
      'UPDATE events SET image_data = NULL, image_mime_type = NULL WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ code: 'EVENT_NOT_FOUND' });
    }

    return res.json({ id, has_image: false });
  } catch (error) {
    console.error('Error deleting event image:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

module.exports = router;
