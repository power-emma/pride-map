const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

const EVENT_COLUMNS = `
  id, title, description, event_date, event_time, location, city, url, created_at
`;

// GET /events — public. Upcoming events only, soonest first.
// Optional ?limit=N and ?city=Name to narrow the results.
router.get('/', async (req, res) => {
  try {
    const city = emptyToNull(req.query.city);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 50);

    const params = [];
    let where = 'WHERE event_date >= CURRENT_DATE';
    if (city) {
      params.push(city);
      where += ` AND city = $${params.length}`;
    }
    params.push(limit);

    const result = await pool.query(
      `SELECT ${EVENT_COLUMNS} FROM events
       ${where}
       ORDER BY event_date ASC, event_time ASC NULLS LAST
       LIMIT $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /events/all — admin only. Every event, most recent first, for management.
router.get('/all', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${EVENT_COLUMNS} FROM events ORDER BY event_date DESC, event_time DESC NULLS LAST`
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

  const eventTime = emptyToNull(body?.event_time);
  const description = emptyToNull(body?.description);
  const location = emptyToNull(body?.location);
  const url = emptyToNull(body?.url);
  const city = emptyToNull(body?.city) || 'Ottawa';

  return { value: { title, description, eventDate, eventTime, location, city, url } };
}

// POST /events — admin only.
router.post('/', requireAuth, async (req, res) => {
  try {
    const { error, value } = validateEventBody(req.body);
    if (error) return res.status(400).json({ error });

    const result = await pool.query(
      `INSERT INTO events (title, description, event_date, event_time, location, city, url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${EVENT_COLUMNS}`,
      [value.title, value.description, value.eventDate, value.eventTime, value.location, value.city, value.url]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
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
         SET title=$1, description=$2, event_date=$3, event_time=$4, location=$5, city=$6, url=$7
       WHERE id=$8
       RETURNING ${EVENT_COLUMNS}`,
      [value.title, value.description, value.eventDate, value.eventTime, value.location, value.city, value.url, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
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

module.exports = router;
