// Test-mode pin generator.
//
// When PIN_SPOOF_COUNT is set (or a ?spoof=N query param is passed), the
// /pins/all route returns this many randomly generated pins instead of the real
// database rows. It's a load-test switch: the server has to build and serialize
// the whole payload, and the client has to fetch, cluster and render it through
// the normal code path.
//
// Pins follow real-world population: most land near a city, weighted by metro
// size, with a Gaussian scatter around each. Canadian cities are boosted heavily
// (the app is Ottawa-centric) so the map opens on a dense, realistic-looking
// Canadian cluster. A small fraction of pins scatter over open land for texture.

// [name, latitude, longitude, metroPopulationMillions] — a spread of major
// world metros across every inhabited continent. Not exhaustive; enough to make
// concentrations look like the real globe.
const WORLD_CITIES = [
    ['Tokyo', 35.68, 139.69, 37], ['Delhi', 28.61, 77.21, 32], ['Shanghai', 31.23, 121.47, 29],
    ['Dhaka', 23.81, 90.41, 23], ['Sao Paulo', -23.55, -46.63, 22], ['Mexico City', 19.43, -99.13, 22],
    ['Cairo', 30.04, 31.24, 21], ['Mumbai', 19.08, 72.88, 21], ['Beijing', 39.90, 116.41, 21],
    ['Osaka', 34.69, 135.50, 19], ['New York', 40.71, -74.01, 19], ['Karachi', 24.86, 67.01, 16],
    ['Buenos Aires', -34.60, -58.38, 15], ['Istanbul', 41.01, 28.98, 15], ['Kolkata', 22.57, 88.36, 15],
    ['Lagos', 6.52, 3.38, 15], ['Kinshasa', -4.32, 15.31, 15], ['Manila', 14.60, 120.98, 14],
    ['Rio de Janeiro', -22.91, -43.17, 13], ['Los Angeles', 34.05, -118.24, 13], ['Bengaluru', 12.97, 77.59, 13],
    ['Lahore', 31.55, 74.34, 13], ['Moscow', 55.76, 37.62, 12], ['Chennai', 13.08, 80.27, 11],
    ['Paris', 48.86, 2.35, 11], ['London', 51.51, -0.13, 11], ['Jakarta', -6.21, 106.85, 11],
    ['Lima', -12.05, -77.04, 11], ['Bogota', 4.71, -74.07, 11], ['Bangkok', 13.76, 100.50, 10],
    ['Johannesburg', -26.20, 28.05, 10], ['Hyderabad', 17.39, 78.49, 10], ['Seoul', 37.57, 126.98, 25],
    ['Chengdu', 30.57, 104.07, 20], ['Guangzhou', 23.13, 113.26, 20], ['Shenzhen', 22.54, 114.06, 17],
    ['Chicago', 41.88, -87.63, 9], ['Tehran', 35.69, 51.39, 9], ['Ho Chi Minh City', 10.82, 106.63, 9],
    ['Kuala Lumpur', 3.14, 101.69, 8], ['Dallas', 32.78, -96.80, 8], ['Luanda', -8.84, 13.23, 8],
    ['Hong Kong', 22.32, 114.17, 7.5], ['Riyadh', 24.71, 46.68, 7], ['Baghdad', 33.31, 44.36, 7],
    ['Santiago', -33.45, -70.67, 7], ['Houston', 29.76, -95.37, 7], ['Dar es Salaam', -6.79, 39.21, 7],
    ['Madrid', 40.42, -3.70, 6.6], ['Washington', 38.90, -77.04, 6.3], ['Miami', 25.76, -80.19, 6],
    ['Atlanta', 33.75, -84.39, 6], ['Philadelphia', 39.95, -75.17, 6], ['Singapore', 1.35, 103.82, 6],
    ['Berlin', 52.52, 13.40, 6], ['Khartoum', 15.50, 32.56, 6], ['Barcelona', 41.39, 2.17, 5.6],
    ['Sydney', -33.87, 151.21, 5.3], ['Melbourne', -37.81, 144.96, 5], ['Nairobi', -1.29, 36.82, 5],
    ['Addis Ababa', 9.03, 38.74, 5], ['Phoenix', 33.45, -112.07, 5], ['Boston', 42.36, -71.06, 4.9],
    ['San Francisco', 37.77, -122.42, 4.7], ['Cape Town', -33.92, 18.42, 4.6], ['Rome', 41.90, 12.50, 4.3],
    ['Detroit', 42.33, -83.05, 4.3], ['Seattle', 47.61, -122.33, 4], ['Accra', 5.60, -0.19, 4],
    ['Casablanca', 33.57, -7.59, 3.7], ['Minneapolis', 44.98, -93.27, 3.7], ['San Diego', 32.72, -117.16, 3.3],
    ['Athens', 37.98, 23.73, 3.2], ['Denver', 39.74, -104.99, 3], ['Kyiv', 50.45, 30.52, 3],
    ['Warsaw', 52.23, 21.01, 3], ['Lisbon', 38.72, -9.14, 2.9], ['Vienna', 48.21, 16.37, 2.9],
    ['Brisbane', -27.47, 153.03, 2.6], ['Portland', 45.52, -122.68, 2.5], ['Amsterdam', 52.37, 4.90, 2.5],
    ['Stockholm', 59.33, 18.06, 2.4], ['Perth', -31.95, 115.86, 2.1], ['Dublin', 53.35, -6.26, 2],
    ['Auckland', -36.85, 174.76, 1.7], ['Helsinki', 60.17, 24.94, 1.3],
];

// Canadian metros. Boosted so Canada is heavily over-represented (see CANADA_BOOST).
const CANADIAN_CITIES = [
    ['Toronto', 43.65, -79.38, 6.4], ['Montreal', 45.50, -73.57, 4.3], ['Vancouver', 49.28, -123.12, 2.6],
    ['Calgary', 51.05, -114.07, 1.6], ['Edmonton', 53.55, -113.49, 1.5], ['Ottawa', 45.42, -75.70, 1.5],
    ['Winnipeg', 49.90, -97.14, 0.85], ['Quebec City', 46.81, -71.21, 0.85], ['Hamilton', 43.26, -79.87, 0.79],
    ['Kitchener', 43.45, -80.49, 0.58], ['London', 42.98, -81.25, 0.55], ['Halifax', 44.65, -63.58, 0.48],
    ['Windsor', 42.31, -83.04, 0.42], ['Victoria', 48.43, -123.37, 0.40], ['Saskatoon', 52.13, -106.67, 0.34],
    ['Regina', 50.45, -104.62, 0.26], ['St. John\'s', 47.56, -52.71, 0.22], ['Kelowna', 49.89, -119.50, 0.22],
    ['Sherbrooke', 45.40, -71.90, 0.22], ['Barrie', 44.39, -79.69, 0.21], ['Abbotsford', 49.05, -122.33, 0.19],
    ['Sudbury', 46.49, -80.99, 0.17], ['Kingston', 44.23, -76.49, 0.17], ['Guelph', 43.54, -80.25, 0.17],
    ['Saguenay', 48.43, -71.07, 0.16], ['Trois-Rivieres', 46.34, -72.54, 0.16], ['Moncton', 46.09, -64.77, 0.16],
    ['Thunder Bay', 48.38, -89.25, 0.12], ['Fredericton', 45.96, -66.64, 0.10], ['Charlottetown', 46.24, -63.13, 0.08],
    ['Whitehorse', 60.72, -135.06, 0.03], ['Yellowknife', 62.45, -114.37, 0.02],
];

// How much to inflate Canadian city weights relative to their real population,
// so Canada is significantly over-represented in the spoofed data.
const CANADA_BOOST = 10;

// Fraction of pins scattered uniformly over open land instead of near a city.
const BACKGROUND_SHARE = 0.04;

// Rough land-only interiors of each region, [minLat, maxLat, minLng, maxLng],
// used only for the background scatter.
const LAND_BOXES = [
    [32, 48, -120, -80], [15, 28, -105, -90], [-30, -5, -65, -40], [41, 55, -3, 25],
    [45, 60, 30, 90], [8, 30, 75, 90], [25, 42, 105, 120], [-25, -6, 135, 145],
    [-3, 9, 10, 30], [-28, -18, 22, 30], [8, 14, -8, 10],
];

const CATEGORIES = [
    'Advocacy Resources', 'Trans Resources', 'Employment Services', 'Community Organisations',
    'Healthcare Resources', 'Student Resources', 'Legal Services', 'Queer Businesses',
    'Queer Nightlife', 'Parents and Family Resources', 'Housing and Shelter',
    'Refugees and Immigrant Resources', 'Sports and Activity Groups',
];

const randBetween = (min, max) => min + Math.random() * (max - min);

// Standard normal via Box–Muller, used to scatter pins around a city centre.
const gaussian = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Build a flat, weighted city list plus a cumulative-weight table so we can pick
// a city in O(log n) proportional to its (boosted) population.
const buildWeightedCities = () => {
    const cities = [
        ...WORLD_CITIES.map(([name, lat, lng, pop]) => ({ name, lat, lng, pop, weight: pop })),
        ...CANADIAN_CITIES.map(([name, lat, lng, pop]) => ({ name, lat, lng, pop, weight: pop * CANADA_BOOST })),
    ];
    const cumulative = [];
    let total = 0;
    for (const c of cities) {
        total += c.weight;
        cumulative.push(total);
    }
    return { cities, cumulative, total };
};

const { cities: CITIES, cumulative: CUMULATIVE, total: TOTAL_WEIGHT } = buildWeightedCities();

// Binary search the cumulative table for a weighted-random city.
const pickCity = () => {
    const r = Math.random() * TOTAL_WEIGHT;
    let lo = 0, hi = CUMULATIVE.length - 1;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (CUMULATIVE[mid] < r) lo = mid + 1;
        else hi = mid;
    }
    return CITIES[lo];
};

const randomCategories = () => {
    const numCats = 1 + Math.floor(Math.random() * 3);
    const categories = [];
    while (categories.length < numCats) {
        const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
        if (!categories.includes(cat)) categories.push(cat);
    }
    return categories;
};

// Generate `count` fake pins in the same shape getValidPins() returns.
const generateSpoofPins = (count) => {
    const pins = new Array(count);
    for (let i = 0; i < count; i++) {
        let latitude, longitude;

        if (Math.random() < BACKGROUND_SHARE) {
            // Sparse rural/open-land scatter.
            const box = LAND_BOXES[Math.floor(Math.random() * LAND_BOXES.length)];
            latitude = randBetween(box[0], box[1]);
            longitude = randBetween(box[2], box[3]);
        } else {
            // Cluster around a population-weighted city. Spread grows with metro
            // size; longitude is widened by 1/cos(lat) so the blob stays roughly
            // circular on the map rather than squished near the poles.
            const city = pickCity();
            const spread = Math.min(0.5, 0.04 + 0.02 * Math.sqrt(city.pop));
            latitude = city.lat + gaussian() * spread;
            const lngScale = 1 / Math.max(0.2, Math.cos(city.lat * Math.PI / 180));
            longitude = city.lng + gaussian() * spread * lngScale;
        }

        // Keep coordinates in valid range.
        latitude = Math.max(-85, Math.min(85, latitude));
        longitude = ((longitude + 540) % 360) - 180;

        pins[i] = {
            name: `Test Pin #${i + 1}`,
            description: 'Spoofed pin generated for load testing.',
            address: null,
            url: null,
            position: [latitude, longitude],
            categories: randomCategories(),
        };
    }
    return pins;
};

// Resolve how many pins to spoof for a request, or 0 to use the real database.
// Precedence: ?spoof=N query param, then the PIN_SPOOF_COUNT env var.
const resolveSpoofCount = (req) => {
    const raw = req.query.spoof ?? process.env.PIN_SPOOF_COUNT;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
};

module.exports = { generateSpoofPins, resolveSpoofCount };
