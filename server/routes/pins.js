const express = require('express');
const router = express.Router();
const pool = require('../db');

// Query locations from the database and convert to pin format
const getValidPins = async () => {
    try {
        const result = await pool.query(
            'SELECT name, latitude, longitude FROM locations WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
        );
        return result.rows.map(location => ({
            name: location.name,
            position: [location.latitude, location.longitude]
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