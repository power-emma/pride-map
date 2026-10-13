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
         e.id, e.title, e.description, e.event_date, e.event_time,
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
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /events/all — admin only. Every event, most recent first, for
// management. Includes the raw (unresolved) image_url plus the linked
// business's name/image so the admin UI can show what it would fall back to.
router.get('/all', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         e.id, e.title, e.description, e.event_date, e.event_time,
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
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

function validateEventBody(body) {
  const title = emptyToNull(body?.title);
  if (!title) return { error: 'title is required' };

  const eventDate = emptyToNull(body?.event_date);
  if (!eventDate || Number.isNaN(Date.parse(eventDate))) {
    return { error: 'event_date is required and must be a valid date' };
  }

  const locationId = parseNullableId(body?.location_id);
  if (Number.isNaN(locationId)) {
    return { error: 'location_id must be a positive integer when provided' };
  }

  const eventTime = emptyToNull(body?.event_time);
  const description = emptyToNull(body?.description);
  const location = emptyToNull(body?.location);
  const url = emptyToNull(body?.url);
  const imageUrl = emptyToNull(body?.image_url);
  const city = emptyToNull(body?.city) || 'Ottawa';

  return { value: { title, description, eventDate, eventTime, location, locationId, city, url, imageUrl } };
}

// POST /events — admin only.
router.post('/', requireAuth, async (req, res) => {
  try {
    const { error, value } = validateEventBody(req.body);
    if (error) return res.status(400).json({ error });

    const result = await pool.query(
      `INSERT INTO events (title, description, event_date, event_time, location, location_id, city, url, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, description, event_date, event_time, location, location_id, city, url, image_url, created_at`,
      [value.title, value.description, value.eventDate, value.eventTime, value.location, value.locationId, value.city, value.url, value.imageUrl]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return res.status(400).json({ error: 'Linked location does not exist' });
    }
    console.error('Error creating event:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /events/:id — admin only.
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const { error, value } = validateEventBody(req.body);
    if (error) return res.status(400).json({ error });

    const result = await pool.query(
      `UPDATE events
         SET title=$1, description=$2, event_date=$3, event_time=$4, location=$5,
             location_id=$6, city=$7, url=$8, image_url=$9
       WHERE id=$10
       RETURNING id, title, description, event_date, event_time, location, location_id, city, url, image_url, created_at`,
      [value.title, value.description, value.eventDate, value.eventTime, value.location, value.locationId, value.city, value.url, value.imageUrl, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return res.status(400).json({ error: 'Linked location does not exist' });
    }
    console.error('Error updating event:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /events/:id — admin only.
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.json({ deleted: id });
  } catch (error) {
    console.error('Error deleting event:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /events/:id/image — public. Serves the event's own uploaded BLOB, if any
// (this does not fall back to the linked location's image — the resolved
// image_url returned by GET / already points straight at whichever one wins).
router.get('/:id/image', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const result = await pool.query(
      'SELECT image_data, image_mime_type FROM events WHERE id = $1',
      [id]
    );
    const row = result.rows[0];
    if (!row || !row.image_data) {
      return res.status(404).json({ error: 'No image uploaded for this event' });
    }

    res.set('Content-Type', row.image_mime_type || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=3600');
    return res.send(row.image_data);
  } catch (error) {
    console.error('Error serving event image:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /events/:id/image — admin only. Uploads (replacing) the image BLOB.
router.post('/:id/image', requireAuth, handleImageUpload, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const result = await pool.query(
      'UPDATE events SET image_data = $1, image_mime_type = $2 WHERE id = $3 RETURNING id',
      [req.file.buffer, req.file.mimetype, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.json({ id, has_image: true });
  } catch (error) {
    console.error('Error uploading event image:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /events/:id/image — admin only. Clears the uploaded BLOB.
router.delete('/:id/image', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const result = await pool.query(
      'UPDATE events SET image_data = NULL, image_mime_type = NULL WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.json({ id, has_image: false });
  } catch (error) {
    console.error('Error deleting event image:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
