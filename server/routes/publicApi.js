const express = require('express');
const pool = require('../db');

const router = express.Router();
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const MAX_OFFSET = 100000;

function parseInteger(value, fallback, min, max) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function parseRegion(value) {
  if (value === undefined) return { valid: true, slug: null };
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return { valid: false };
  }
  return { valid: true, slug: value };
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) || typeof value === 'object'
    ? JSON.stringify(value)
    : String(value);
  const safeText = typeof value === 'string' &&
    (/^[\t\r=+@]/.test(text) || /^[\s]*[-=+@]/.test(text))
    ? `'${text}`
    : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function sendCsv(res, filename, columns, rows) {
  const csv = [
    columns.map(([, label]) => csvCell(label)).join(','),
    ...rows.map(row => columns.map(([field]) => csvCell(row[field])).join(',')),
  ].join('\r\n');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.type('text/csv; charset=utf-8').send(`${csv}\r\n`);
}

function applyPublicCacheHeaders(res) {
  res.set('Cache-Control', 'public, max-age=60');
}

async function findRegion(slug) {
  if (slug === null) return { id: null };
  const result = await pool.query(
    'SELECT id, name, slug FROM regions WHERE slug = $1',
    [slug]
  );
  return result.rows[0] || null;
}

function organizationRecord(row) {
  return {
    id: row.id,
    name: row.name,
    name_fr: row.name_fr,
    description: row.description,
    description_fr: row.description_fr,
    region: { id: row.region_id, slug: row.region_slug, name: row.region_name },
    address: row.address,
    coordinates: {
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
    },
    website: row.url,
    contact: { email: row.contact_email, phone: row.contact_phone },
    hours: row.hours,
    categories: row.categories || [],
    tags: row.tags || [],
    updated_at: row.updated_at,
  };
}

function eventRecord(row) {
  return {
    id: row.id,
    title: row.title,
    title_fr: row.title_fr,
    description: row.description,
    description_fr: row.description_fr,
    region: { id: row.region_id, slug: row.region_slug, name: row.region_name },
    start_date: row.event_date,
    start_time: row.event_time,
    location: row.location,
    location_id: row.location_id,
    city: row.city,
    website: row.url,
    tags: row.tags || [],
    updated_at: row.updated_at,
  };
}

async function listOrganizations(regionId, limit, offset) {
  const values = [];
  let where = '';
  if (regionId !== null) {
    values.push(regionId);
    where = `WHERE l.region_id = $${values.length}`;
  }

  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM locations l ${where}`,
    values
  );
  const pagination = Number.isInteger(limit)
    ? (values.push(limit, offset), `LIMIT $${values.length - 1} OFFSET $${values.length}`)
    : '';
  const result = await pool.query(
    `SELECT l.id, l.name, l.name_fr, l.description, l.description_fr,
            l.region_id, r.slug AS region_slug, r.name AS region_name,
            l.address, l.latitude::float8 AS latitude, l.longitude::float8 AS longitude,
            l.url, l.contact_email, l.contact_phone, l.hours, l.tags, l.updated_at,
            COALESCE(
              ARRAY_AGG(c.name ORDER BY LOWER(c.name), c.name)
                FILTER (WHERE c.id IS NOT NULL),
              '{}'
            ) AS categories
     FROM locations l
     JOIN regions r ON r.id = l.region_id
     LEFT JOIN location_categories lc ON lc.id_location = l.id
     LEFT JOIN categories c ON c.id = lc.id_category
     ${where}
     GROUP BY l.id, r.id
     ORDER BY LOWER(l.name), l.id
     ${pagination}`,
    values
  );
  return { total: count.rows[0].total, rows: result.rows };
}

async function listEvents(regionId, limit, offset, upcomingOnly) {
  const values = [];
  const predicates = [];
  if (regionId !== null) {
    values.push(regionId);
    predicates.push(`e.region_id = $${values.length}`);
  }
  if (upcomingOnly) predicates.push('e.event_date >= CURRENT_DATE');
  const where = predicates.length ? `WHERE ${predicates.join(' AND ')}` : '';
  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM events e ${where}`,
    values
  );
  const pagination = Number.isInteger(limit)
    ? (values.push(limit, offset), `LIMIT $${values.length - 1} OFFSET $${values.length}`)
    : '';
  const result = await pool.query(
    `SELECT e.id, e.title, e.title_fr, e.description, e.description_fr,
            e.region_id, r.slug AS region_slug, r.name AS region_name,
            e.event_date::text AS event_date, e.event_time::text AS event_time,
            e.location, e.location_id, e.city, e.url, e.tags, e.updated_at
     FROM events e
     JOIN regions r ON r.id = e.region_id
     ${where}
     ORDER BY e.event_date, e.event_time NULLS LAST, e.id
     ${pagination}`,
    values
  );
  return { total: count.rows[0].total, rows: result.rows };
}

async function getRequestFilters(req, res, includePagination) {
  const parsedRegion = parseRegion(req.query.region);
  if (!parsedRegion.valid) {
    res.status(400).json({ code: 'INVALID_REGION' });
    return null;
  }

  const region = await findRegion(parsedRegion.slug);
  if (!region) {
    res.status(404).json({ code: 'REGION_NOT_FOUND' });
    return null;
  }

  if (!includePagination) return { regionId: region.id };
  const limit = parseInteger(req.query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = parseInteger(req.query.offset, 0, 0, MAX_OFFSET);
  if (limit === null || offset === null) {
    res.status(400).json({ code: 'INVALID_PAGINATION' });
    return null;
  }
  return { regionId: region.id, limit, offset };
}

async function handleOrganizations(req, res, format) {
  try {
    const filters = await getRequestFilters(req, res, format === 'json');
    if (!filters) return;
    const { rows, total } = await listOrganizations(
      filters.regionId,
      filters.limit,
      filters.offset
    );
    applyPublicCacheHeaders(res);
    if (format === 'csv') {
      const csvRows = rows.map(organizationRecord).map(record => ({
        id: record.id,
        name: record.name,
        name_fr: record.name_fr,
        description: record.description,
        description_fr: record.description_fr,
        region_slug: record.region.slug,
        region_name: record.region.name,
        address: record.address,
        latitude: record.coordinates.latitude,
        longitude: record.coordinates.longitude,
        website: record.website,
        contact_email: record.contact.email,
        contact_phone: record.contact.phone,
        hours: record.hours,
        categories: record.categories,
        tags: record.tags,
        updated_at: record.updated_at,
      }));
      return sendCsv(res, 'pride-map-organizations.csv', [
        ['id', 'id'], ['name', 'name'], ['name_fr', 'name_fr'],
        ['description', 'description'], ['description_fr', 'description_fr'],
        ['region_slug', 'region_slug'], ['region_name', 'region_name'],
        ['address', 'address'], ['latitude', 'latitude'], ['longitude', 'longitude'],
        ['website', 'website'], ['contact_email', 'contact_email'],
        ['contact_phone', 'contact_phone'], ['hours', 'hours'],
        ['categories', 'categories'], ['tags', 'tags'], ['updated_at', 'updated_at'],
      ], csvRows);
    }
    return res.json({
      data: rows.map(organizationRecord),
      pagination: { limit: filters.limit, offset: filters.offset, total },
    });
  } catch (error) {
    console.error('Error fetching public organizations:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
}

async function handleEvents(req, res, format) {
  try {
    const filters = await getRequestFilters(req, res, format === 'json');
    if (!filters) return;

    let upcomingOnly = false;
    if (req.query.upcoming !== undefined) {
      if (req.query.upcoming !== 'true' && req.query.upcoming !== 'false') {
        return res.status(400).json({ code: 'INVALID_UPCOMING_FILTER' });
      }
      upcomingOnly = req.query.upcoming === 'true';
    }

    const { rows, total } = await listEvents(
      filters.regionId,
      filters.limit,
      filters.offset,
      upcomingOnly
    );
    applyPublicCacheHeaders(res);
    if (format === 'csv') {
      const csvRows = rows.map(eventRecord).map(record => ({
        id: record.id,
        title: record.title,
        title_fr: record.title_fr,
        description: record.description,
        description_fr: record.description_fr,
        region_slug: record.region.slug,
        region_name: record.region.name,
        start_date: record.start_date,
        start_time: record.start_time,
        location: record.location,
        location_id: record.location_id,
        city: record.city,
        website: record.website,
        tags: record.tags,
        updated_at: record.updated_at,
      }));
      return sendCsv(res, 'pride-map-events.csv', [
        ['id', 'id'], ['title', 'title'], ['title_fr', 'title_fr'],
        ['description', 'description'], ['description_fr', 'description_fr'],
        ['region_slug', 'region_slug'], ['region_name', 'region_name'],
        ['start_date', 'start_date'], ['start_time', 'start_time'],
        ['location', 'location'], ['location_id', 'location_id'], ['city', 'city'],
        ['website', 'website'], ['tags', 'tags'], ['updated_at', 'updated_at'],
      ], csvRows);
    }
    return res.json({
      data: rows.map(eventRecord),
      pagination: { limit: filters.limit, offset: filters.offset, total },
    });
  } catch (error) {
    console.error('Error fetching public events:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
}

router.get('/regions', async (req, res) => {
  try {
    applyPublicCacheHeaders(res);
    const result = await pool.query(
      'SELECT id, name, slug, updated_at FROM regions ORDER BY LOWER(name), id'
    );
    return res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching public regions:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

router.get('/organizations', (req, res) => handleOrganizations(req, res, 'json'));
router.get('/organizations.csv', (req, res) => handleOrganizations(req, res, 'csv'));
router.get('/events', (req, res) => handleEvents(req, res, 'json'));
router.get('/events.csv', (req, res) => handleEvents(req, res, 'csv'));

module.exports = router;
