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

// Filter locations that have valid coordinates
const getValidPins = () => {
    return allLocations
        .filter(location => location.latitude !== null && location.longitude !== null)
        .map(location => ({
            name: location.name,
            position: [location.latitude, location.longitude],
            description: location.description,
            address: location.address,
            url: location.url
        }));
};

// Define a route
router.get('/', (req, res) => {
    res.send({'message': 'Pins Main Route'});
});

// Define a route
router.get('/all', (req, res) => {
    const pins = getValidPins();
    res.json(pins);
});


// export the router module so that server.js file can use it
module.exports = router;