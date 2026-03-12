const express = require('express');
const router = express.Router();
const pool = require('../db'); // Ensure this is your database connection

// Get all locations for cards (doesn't require coordinates)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT name, description, address, latitude::float8 AS latitude, longitude::float8 AS longitude, url FROM locations');
        const cards = result.rows.map(location => ({
            name: location.name,
            description: location.description,
            address: location.address,
            latitude: location.latitude,
            longitude: location.longitude,
            url: location.url
        }));
        res.json(cards);
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get only locations with valid coordinates
router.get('/with-location', async (req, res) => {
    try {
        const result = await pool.query('SELECT name, description, address, latitude::float8 AS latitude, longitude::float8 AS longitude, url FROM locations WHERE latitude IS NOT NULL AND longitude IS NOT NULL');
        const cards = result.rows.map(location => ({
            name: location.name,
            description: location.description,
            address: location.address,
            latitude: location.latitude,
            longitude: location.longitude,
            url: location.url
        }));
        res.json(cards);
    } catch (error) {
        console.error('Error fetching locations with coordinates:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// export the router module so that server.js file can use it
module.exports = router;
