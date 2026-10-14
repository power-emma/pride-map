const express = require('express');
const router = express.Router();
const pool = require('../db'); // Ensure this is your database connection

// Get all locations for cards (doesn't require coordinates)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                l.name,
                l.name_fr,
                l.description,
                l.description_fr,
                l.address,
                l.latitude::float8 AS latitude,
                l.longitude::float8 AS longitude,
                l.url,
                CASE WHEN l.image_data IS NOT NULL THEN '/api/locations/' || l.id || '/image' ELSE l.image_url END AS image_url,
                COALESCE(
                    ARRAY_AGG(c.name ORDER BY c.name) FILTER (WHERE c.name IS NOT NULL),
                    '{}'
                ) AS categories
            FROM locations l
            LEFT JOIN location_categories lc ON lc.id_location = l.id
            LEFT JOIN categories c ON c.id = lc.id_category
            GROUP BY l.id, l.name, l.name_fr, l.description, l.description_fr, l.address, l.latitude, l.longitude, l.url, l.image_url
            ORDER BY l.name
        `);
        const cards = result.rows.map(location => ({
            name: location.name,
            name_fr: location.name_fr,
            description: location.description,
            description_fr: location.description_fr,
            address: location.address,
            latitude: location.latitude,
            longitude: location.longitude,
            url: location.url,
            image_url: location.image_url,
            categories: location.categories
        }));
        res.json(cards);
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
    }
});

// Get only locations with valid coordinates
router.get('/with-location', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                l.name,
                l.name_fr,
                l.description,
                l.description_fr,
                l.address,
                l.latitude::float8 AS latitude,
                l.longitude::float8 AS longitude,
                l.url,
                CASE WHEN l.image_data IS NOT NULL THEN '/api/locations/' || l.id || '/image' ELSE l.image_url END AS image_url,
                COALESCE(
                    ARRAY_AGG(c.name ORDER BY c.name) FILTER (WHERE c.name IS NOT NULL),
                    '{}'
                ) AS categories
            FROM locations l
            LEFT JOIN location_categories lc ON lc.id_location = l.id
            LEFT JOIN categories c ON c.id = lc.id_category
            WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL
            GROUP BY l.id, l.name, l.name_fr, l.description, l.description_fr, l.address, l.latitude, l.longitude, l.url, l.image_url
            ORDER BY l.name
        `);
        const cards = result.rows.map(location => ({
            name: location.name,
            name_fr: location.name_fr,
            description: location.description,
            description_fr: location.description_fr,
            address: location.address,
            latitude: location.latitude,
            longitude: location.longitude,
            url: location.url,
            image_url: location.image_url,
            categories: location.categories
        }));
        res.json(cards);
    } catch (error) {
        console.error('Error fetching locations with coordinates:', error);
        res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
    }
});

// export the router module so that server.js file can use it
module.exports = router;
