const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock secret.js so tests never touch the filesystem
const TEST_JWT_SECRET = 'test-secret-do-not-use-in-production';
jest.mock('./secret', () => ({ jwtSecret: 'test-secret-do-not-use-in-production' }));

// Helper: create a signed token for protected route tests
function makeToken() {
    return jwt.sign({ username: 'testuser' }, TEST_JWT_SECRET, { expiresIn: '1h' });
}

// Replace ../db with a fake pool before any route module loads it
const mockLocations = [
    { id: 1, name: 'AIDS Committee of Ottawa', description: 'HIV/AIDS support services.', address: '19 Main St, Ottawa, ON K1S 1A9', latitude: 45.4145, longitude: -75.6810, url: 'https://www.aco-cso.ca/', category_ids: [1, 3] },
    { id: 2, name: 'Bruce House',              description: 'Housing support for those with HIV.', address: '251 Bank St, Ottawa, ON K2P 1X2', latitude: 45.4163, longitude: -75.6897, url: 'https://brucehouse.org/', category_ids: [5] },
    { id: 3, name: 'Capital Pride',            description: 'Ottawa Pride festival organisation.', address: null, latitude: null, longitude: null, url: 'https://capitalpride.ca/', category_ids: [] },
];

jest.mock('./db', () => ({
    query: jest.fn((sql) => {
        // Return only rows with coordinates when the query filters by latitude/longitude
        const wantsCoords = sql.includes('IS NOT NULL');
        const rows = wantsCoords
            ? mockLocations.filter(l => l.latitude !== null && l.longitude !== null)
            : mockLocations;
        return Promise.resolve({ rows, rowCount: rows.length });
    }),
    end: jest.fn(() => Promise.resolve()),
}));

const app = require('./server');
const pool = require('./db');

afterEach(() => {
    pool.query.mockClear();
});

afterAll(async () => {
    await pool.end();
});

describe('GET /', () => {
    it('should return 200 and the live message', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toBe(200);
        expect(res.text).toBe('We are Live!');
    });
});

describe('GET /pins', () => {
    it('should return 200 and a message object at the root', async () => {
        const res = await request(app).get('/pins');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('message', 'Pins Main Route');
    });

    it('should return 200 and an array of pins at /pins/all', async () => {
        const res = await request(app).get('/pins/all');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('each pin should have a name and a position with two coordinates', async () => {
        const res = await request(app).get('/pins/all');
        for (const pin of res.body) {
            expect(pin).toHaveProperty('name');
            expect(pin).toHaveProperty('position');
            expect(Array.isArray(pin.position)).toBe(true);
            expect(pin.position).toHaveLength(2);
            expect(typeof pin.position[0]).toBe('number');
            expect(typeof pin.position[1]).toBe('number');
        }
    });
});

describe('GET /cards', () => {
    it('should return 200 and an array of all cards', async () => {
        const res = await request(app).get('/cards');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });

    it('each card should have the expected fields', async () => {
        const res = await request(app).get('/cards');
        for (const card of res.body) {
            expect(card).toHaveProperty('name');
            expect(card).toHaveProperty('description');
            expect(card).toHaveProperty('address');
            expect(card).toHaveProperty('latitude');
            expect(card).toHaveProperty('longitude');
            expect(card).toHaveProperty('url');
        }
    });

    it('should return 200 and only cards with coordinates at /cards/with-location', async () => {
        const res = await request(app).get('/cards/with-location');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        for (const card of res.body) {
            expect(card.latitude).not.toBeNull();
            expect(card.longitude).not.toBeNull();
            expect(typeof card.latitude).toBe('number');
            expect(typeof card.longitude).toBe('number');
        }
    });

    it('/cards/with-location should return a subset of /cards', async () => {
        const allCards = (await request(app).get('/cards')).body;
        const locatedCards = (await request(app).get('/cards/with-location')).body;
        expect(locatedCards.length).toBeLessThanOrEqual(allCards.length);
    });
});

describe('GET /locations', () => {
    it('should return 200 and an array of all locations', async () => {
        const res = await request(app).get('/locations');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });

    it('each location should have the expected fields', async () => {
        const res = await request(app).get('/locations');
        for (const loc of res.body) {
            expect(loc).toHaveProperty('name');
            expect(loc).toHaveProperty('description');
            expect(loc).toHaveProperty('address');
            expect(loc).toHaveProperty('latitude');
            expect(loc).toHaveProperty('longitude');
            expect(loc).toHaveProperty('url');
            expect(loc).toHaveProperty('category_ids');
            expect(Array.isArray(loc.category_ids)).toBe(true);
        }
    });
});

describe('POST /locations', () => {
    it('should return 201 and the new location when given a valid name', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ id: 99 }], rowCount: 1 });
        const res = await request(app)
            .post('/locations')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ name: 'New Place', category_ids: [] });
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('id', 99);
        expect(res.body).toHaveProperty('name', 'New Place');
    });

    it('should return 401 when no token is provided', async () => {
        const res = await request(app)
            .post('/locations')
            .send({ name: 'New Place', category_ids: [] });
        expect(res.statusCode).toBe(401);
    });

    it('should return 400 when name is missing', async () => {
        const res = await request(app)
            .post('/locations')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ description: 'No name here' });
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('should return 400 when latitude is not a number', async () => {
        const res = await request(app)
            .post('/locations')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ name: 'Bad Coords', latitude: 'not-a-number', category_ids: [] });
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});

describe('PUT /locations/:id', () => {
    it('should return 200 and the updated location', async () => {
        // First call: UPDATE returning id; second call: DELETE categories; third call: INSERT category
        pool.query
            .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })
            .mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await request(app)
            .put('/locations/1')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ name: 'Updated Name', category_ids: [2] });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('name', 'Updated Name');
        expect(res.body).toHaveProperty('category_ids');
    });

    it('should return 401 when no token is provided', async () => {
        const res = await request(app)
            .put('/locations/1')
            .send({ name: 'Updated Name', category_ids: [] });
        expect(res.statusCode).toBe(401);
    });

    it('should return 404 when the location does not exist', async () => {
        pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await request(app)
            .put('/locations/9999')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ name: 'Ghost', category_ids: [] });
        expect(res.statusCode).toBe(404);
        expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for an invalid id', async () => {
        const res = await request(app)
            .put('/locations/abc')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ name: 'Bad ID', category_ids: [] });
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});

describe('DELETE /locations/:id', () => {
    it('should return 200 and the deleted id', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
        const res = await request(app)
            .delete('/locations/1')
            .set('Authorization', `Bearer ${makeToken()}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('deleted', 1);
    });

    it('should return 401 when no token is provided', async () => {
        const res = await request(app).delete('/locations/1');
        expect(res.statusCode).toBe(401);
    });

    it('should return 404 when the location does not exist', async () => {
        pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await request(app)
            .delete('/locations/9999')
            .set('Authorization', `Bearer ${makeToken()}`);
        expect(res.statusCode).toBe(404);
        expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for an invalid id', async () => {
        const res = await request(app)
            .delete('/locations/abc')
            .set('Authorization', `Bearer ${makeToken()}`);
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});
