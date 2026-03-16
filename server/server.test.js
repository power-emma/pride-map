const request = require('supertest');

const mockRows = [
    {
        name: 'Community Hub',
        description: 'Support services',
        address: '123 Main St',
        latitude: 45.4215,
        longitude: -75.6972,
        url: 'https://example.com/hub'
    },
    {
        name: 'No Coordinates Resource',
        description: 'Phone support',
        address: '456 Side St',
        latitude: null,
        longitude: null,
        url: 'https://example.com/phone'
    }
];

jest.mock('pg', () => ({
    Pool: jest.fn(() => ({
        query: jest.fn((sql) => {
            if (sql.includes('WHERE latitude IS NOT NULL AND longitude IS NOT NULL')) {
                return Promise.resolve({
                    rows: mockRows.filter((row) => row.latitude !== null && row.longitude !== null)
                });
            }

            return Promise.resolve({ rows: mockRows });
        })
    }))
}));

const app = require('./server');

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
