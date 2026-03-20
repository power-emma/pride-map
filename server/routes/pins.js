const express = require('express');
const router = express.Router();
const pool = require('../db');

// Query locations from the database and convert to pin format
const getValidPins = async () => {
    try {
        const result = await pool.query(`
            SELECT
                l.name,
                l.latitude::float8 AS latitude,
                l.longitude::float8 AS longitude,
                COALESCE(
                    ARRAY_AGG(c.name ORDER BY c.name) FILTER (WHERE c.name IS NOT NULL),
                    '{}'
                ) AS categories
            FROM locations l
            LEFT JOIN location_categories lc ON lc.id_location = l.id
            LEFT JOIN categories c ON c.id = lc.id_category
            WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL
            GROUP BY l.id, l.name, l.latitude, l.longitude
        `);
        return result.rows.map(location => ({
            name: location.name,
            position: [location.latitude, location.longitude],
            categories: location.categories
        }));
    } catch (error) {
        console.error('Error fetching locations from database:', error);
        return [];
    }
};

// Define a route
router.get('/', (req, res) => {
    res.send({'message': 'Pins Main Route'});
});

// Define a route
router.get('/all', async (req, res) => {
    const pins = await getValidPins();
    res.json(pins);
});


// export the router module so that server.js file can use it
module.exports = router;