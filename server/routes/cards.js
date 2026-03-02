const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Load locations from JSON file
const locationsPath = path.join(__dirname, '../queer_ottawa_locations.json');
let allLocations = [];

try {
    const data = fs.readFileSync(locationsPath, 'utf8');
    allLocations = JSON.parse(data);
} catch (error) {
    console.error('Error loading locations:', error);
}

// Get all locations for cards (doesn't require coordinates)
router.get('/', (req, res) => {
    const cards = allLocations.map(location => ({
        name: location.name,
        description: location.description,
        address: location.address,
        latitude: location.latitude,
        longitude: location.longitude,
        url: location.url
    }));
    res.json(cards);
});

// Get only locations with valid coordinates
router.get('/with-location', (req, res) => {
    const cards = allLocations
        .filter(location => location.latitude !== null && location.longitude !== null)
        .map(location => ({
            name: location.name,
            description: location.description,
            address: location.address,
            latitude: location.latitude,
            longitude: location.longitude,
            url: location.url
        }));
    res.json(cards);
});

// export the router module so that server.js file can use it
module.exports = router;
