const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock secret.js so tests never touch the filesystem
const TEST_JWT_SECRET = 'test-secret-do-not-use-in-production';
jest.mock('./secret', () => ({ jwtSecret: 'test-secret-do-not-use-in-production' }));

// Accounts behind the test tokens: id 1 is an admin, any other id is a
// regular user. Stubbed separately from ./db so the auth lookup never consumes
// the per-test pool.query mocks queued for the route itself.
const ADMIN_ID = 1;
jest.mock('./userStore', () => ({
    getUserById: jest.fn((id) => Promise.resolve({
        id,
        username: id === 1 ? 'admin' : `user${id}`,
        email: `user${id}@example.com`,
        is_admin: id === 1,
        password_changed_at: null,
    })),
}));

// Helper: create a signed token for protected route tests (admin by default)
function makeToken(id = ADMIN_ID) {
    return jwt.sign({ id, username: id === ADMIN_ID ? 'admin' : `user${id}` }, TEST_JWT_SECRET, { expiresIn: '1h' });
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

describe('GET /pins/all — spoof test mode', () => {
    it('returns the requested number of spoofed pins via ?spoof=N', async () => {
        const res = await request(app).get('/pins/all?spoof=250');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(250);
        // Spoofing should not hit the database.
        expect(pool.query).not.toHaveBeenCalled();
    });

    it('generates well-formed pins with sane world coordinates', async () => {
        const res = await request(app).get('/pins/all?spoof=100');
        for (const pin of res.body) {
            expect(pin).toHaveProperty('name');
            expect(pin.position).toHaveLength(2);
            const [lat, lng] = pin.position;
            expect(lat).toBeGreaterThanOrEqual(-90);
            expect(lat).toBeLessThanOrEqual(90);
            expect(lng).toBeGreaterThanOrEqual(-180);
            expect(lng).toBeLessThanOrEqual(180);
            expect(Array.isArray(pin.categories)).toBe(true);
            expect(pin.categories.length).toBeGreaterThan(0);
        }
    });

    it('honours the PIN_SPOOF_COUNT env var', async () => {
        process.env.PIN_SPOOF_COUNT = '42';
        try {
            const res = await request(app).get('/pins/all');
            expect(res.body).toHaveLength(42);
            expect(pool.query).not.toHaveBeenCalled();
        } finally {
            delete process.env.PIN_SPOOF_COUNT;
        }
    });

    it('falls back to the database when spoofing is off', async () => {
        const res = await request(app).get('/pins/all');
        expect(res.statusCode).toBe(200);
        expect(pool.query).toHaveBeenCalled();
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
            expect(res.body).toHaveProperty('code', 'NAME_REQUIRED');
    });

    it('should return 400 when latitude is not a number', async () => {
        const res = await request(app)
            .post('/locations')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ name: 'Bad Coords', latitude: 'not-a-number', category_ids: [] });
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('code', 'INVALID_COORDINATES');
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
        expect(res.body).toHaveProperty('code', 'UNAUTHENTICATED');
    });

    it('should return 404 when the location does not exist', async () => {
        pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await request(app)
            .put('/locations/9999')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ name: 'Ghost', category_ids: [] });
        expect(res.statusCode).toBe(404);
        expect(res.body).toHaveProperty('code', 'LOCATION_NOT_FOUND');
    });

    it('should return 400 for an invalid id', async () => {
        const res = await request(app)
            .put('/locations/abc')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ name: 'Bad ID', category_ids: [] });
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('code', 'INVALID_LOCATION_ID');
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
        expect(res.body).toHaveProperty('code', 'LOCATION_NOT_FOUND');
    });

    it('should return 400 for an invalid id', async () => {
        const res = await request(app)
            .delete('/locations/abc')
            .set('Authorization', `Bearer ${makeToken()}`);
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('code', 'INVALID_LOCATION_ID');
    });
});

describe('Events', () => {
    const eventBody = {
        title: '',
        title_fr: 'Fête de la fierté',
        description: 'A community celebration.',
        description_fr: 'Une célébration communautaire.',
        event_date: '2030-06-20',
        city: 'Ottawa',
    };

    it('returns a stable code when required event title is missing', async () => {
        const res = await request(app)
            .post('/events')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ ...eventBody, title_fr: '' });

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ code: 'TITLE_REQUIRED' });
    });

    it('returns French event content from the public endpoint', async () => {
        pool.query.mockResolvedValueOnce({
            rows: [{
                id: 1,
                title: 'Fête de la fierté',
                title_fr: 'Fête de la fierté',
                description: 'A community celebration.',
                description_fr: 'Une célébration communautaire.',
            }],
            rowCount: 1,
        });

        const res = await request(app).get('/events');

        expect(res.statusCode).toBe(200);
        expect(res.body[0]).toMatchObject({
            title_fr: 'Fête de la fierté',
            description_fr: 'Une célébration communautaire.',
        });
    });

    it('creates an event with French-only title and content', async () => {
        pool.query.mockResolvedValueOnce({
            rows: [{ id: 12, title: 'Fête de la fierté', title_fr: 'Fête de la fierté', description_fr: eventBody.description_fr }],
            rowCount: 1,
        });

        const res = await request(app)
            .post('/events')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send(eventBody);

        expect(res.statusCode).toBe(201);
        expect(res.body).toMatchObject({
            title: 'Fête de la fierté',
            title_fr: 'Fête de la fierté',
            description_fr: 'Une célébration communautaire.',
        });
        expect(pool.query.mock.calls[0][1]).toEqual([
            'Fête de la fierté',
            'Fête de la fierté',
            'A community celebration.',
            'Une célébration communautaire.',
            '2030-06-20',
            null,
            null,
            null,
            'Ottawa',
            null,
            null,
            null,
        ]);
    });

    it('updates bilingual event content', async () => {
        pool.query.mockResolvedValueOnce({
            rows: [{ id: 12, title: 'Pride celebration', title_fr: 'Fête de la fierté', description_fr: eventBody.description_fr }],
            rowCount: 1,
        });

        const res = await request(app)
            .put('/events/12')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ ...eventBody, title: 'Pride celebration' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({
            title: 'Pride celebration',
            title_fr: 'Fête de la fierté',
            description_fr: 'Une célébration communautaire.',
        });
        expect(pool.query.mock.calls[0][1]).toEqual([
            'Pride celebration',
            'Fête de la fierté',
            'A community celebration.',
            'Une célébration communautaire.',
            '2030-06-20',
            null,
            null,
            null,
            'Ottawa',
            null,
            null,
            12,
        ]);
    });
});

describe('Submissions', () => {
    const validBody = {
        name: 'Rainbow Cafe',
        category_ids: [],
    };

    describe('POST /submissions (signed-in users)', () => {
        it('should return 401 without a token', async () => {
            const res = await request(app).post('/submissions').send(validBody);
            expect(res.statusCode).toBe(401);
            expect(res.body).toHaveProperty('code', 'UNAUTHENTICATED');
        });

        it('should return 400 when the name is missing', async () => {
            const res = await request(app)
                .post('/submissions')
                .set('Authorization', `Bearer ${makeToken(20)}`)
                .send({ ...validBody, name: '' });
            expect(res.statusCode).toBe(400);
        });

        it('should accept valid submissions then rate-limit the account', async () => {
            const token = makeToken(21);
            for (let i = 0; i < 10; i++) {
                pool.query.mockResolvedValueOnce({ rows: [{ id: 42 }], rowCount: 1 });
                const ok = await request(app)
                    .post('/submissions')
                    .set('Authorization', `Bearer ${token}`)
                    .send(validBody);
                expect(ok.statusCode).toBe(201);
                expect(ok.body).toMatchObject({ id: 42, status: 'pending' });
            }

            const limited = await request(app)
                .post('/submissions')
                .set('Authorization', `Bearer ${token}`)
                .send(validBody);
            expect(limited.statusCode).toBe(429);
            expect(limited.headers).toHaveProperty('retry-after');

            // Another account is unaffected.
            pool.query.mockResolvedValueOnce({ rows: [{ id: 43 }], rowCount: 1 });
            const other = await request(app)
                .post('/submissions')
                .set('Authorization', `Bearer ${makeToken(22)}`)
                .send(validBody);
            expect(other.statusCode).toBe(201);
        });

        it('stores French content and links the submission to the account', async () => {
            pool.query.mockResolvedValueOnce({ rows: [{ id: 43 }], rowCount: 1 });

            const res = await request(app)
                .post('/submissions')
                .set('Authorization', `Bearer ${makeToken(23)}`)
                .send({
                    name: '',
                    name_fr: 'Café arc-en-ciel',
                    description_fr: 'Un espace communautaire.',
                    category_ids: [],
                });

            expect(res.statusCode).toBe(201);
            expect(pool.query.mock.calls[0][1]).toEqual([
                'Café arc-en-ciel',
                'Café arc-en-ciel',
                null,
                'Un espace communautaire.',
                null,
                null,
                null,
                null,
                null,
                'user23@example.com',
                [],
                23,
            ]);
        });
    });

    describe('Submitter endpoints', () => {
        it('PUT /submissions/:id only matches the submitter\'s own pending row', async () => {
            pool.query.mockResolvedValueOnce({ rows: [{ id: 5, name: 'Mine' }], rowCount: 1 });
            const res = await request(app)
                .put('/submissions/5')
                .set('Authorization', `Bearer ${makeToken(24)}`)
                .send({ name: 'Mine', submitter_email: 'ignored@example.com' });
            expect(res.statusCode).toBe(200);
            const [sql, params] = pool.query.mock.calls[0];
            expect(sql).toContain('AND user_id = $13');
            // Only admins can change the contact email.
            expect(params[9]).toBeNull();
            expect(params[12]).toBe(24);
        });

        it('DELETE /submissions/:id withdraws the submitter\'s own pending row', async () => {
            pool.query.mockResolvedValueOnce({ rows: [{ id: 5 }], rowCount: 1 });
            const res = await request(app)
                .delete('/submissions/5')
                .set('Authorization', `Bearer ${makeToken(24)}`);
            expect(res.statusCode).toBe(200);
            expect(pool.query.mock.calls[0][1]).toEqual([5, 24]);
        });

        it('approve and reject are admin only', async () => {
            const approve = await request(app)
                .post('/submissions/1/approve')
                .set('Authorization', `Bearer ${makeToken(24)}`);
            expect(approve.statusCode).toBe(403);
            expect(approve.body).toHaveProperty('code', 'ADMIN_REQUIRED');

            const list = await request(app)
                .get('/submissions')
                .set('Authorization', `Bearer ${makeToken(24)}`);
            expect(list.statusCode).toBe(403);
        });
    });

    describe('Admin submission endpoints require auth', () => {
        it('GET /submissions should return 401 without a token', async () => {
            const res = await request(app).get('/submissions');
            expect(res.statusCode).toBe(401);
        });

        it('POST /submissions/:id/approve should return 401 without a token', async () => {
            const res = await request(app).post('/submissions/1/approve');
            expect(res.statusCode).toBe(401);
        });

        it('POST /submissions/:id/reject should return 401 without a token', async () => {
            const res = await request(app).post('/submissions/1/reject');
            expect(res.statusCode).toBe(401);
        });

        it('GET /submissions should return the pending queue with a valid token', async () => {
            pool.query.mockResolvedValueOnce({
                rows: [{ id: 1, name: 'Rainbow Cafe', status: 'pending', category_ids: [] }],
                rowCount: 1,
            });
            const res = await request(app)
                .get('/submissions')
                .set('Authorization', `Bearer ${makeToken()}`);
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('POST /submissions/:id/reject should return 400 for an invalid id', async () => {
            const res = await request(app)
                .post('/submissions/abc/reject')
                .set('Authorization', `Bearer ${makeToken()}`);
            expect(res.statusCode).toBe(400);
        });

        it('PUT /submissions/:id should return 401 without a token', async () => {
            const res = await request(app)
                .put('/submissions/1')
                .send({ name: 'X', submitter_email: 'a@b.co' });
            expect(res.statusCode).toBe(401);
        });

        it('PUT /submissions/:id should return 400 when name is missing', async () => {
            const res = await request(app)
                .put('/submissions/1')
                .set('Authorization', `Bearer ${makeToken()}`)
                .send({ name: '', submitter_email: 'a@b.co' });
            expect(res.statusCode).toBe(400);
        });

        it('PUT /submissions/:id should return 400 for an invalid email', async () => {
            const res = await request(app)
                .put('/submissions/1')
                .set('Authorization', `Bearer ${makeToken()}`)
                .send({ name: 'Rainbow Cafe', submitter_email: 'nope' });
            expect(res.statusCode).toBe(400);
        });

        it('PUT /submissions/:id should update a pending submission', async () => {
            pool.query.mockResolvedValueOnce({
                rows: [{ id: 1, name: 'Edited Cafe', submitter_email: 'a@b.co', status: 'pending', category_ids: [2] }],
                rowCount: 1,
            });
            const res = await request(app)
                .put('/submissions/1')
                .set('Authorization', `Bearer ${makeToken()}`)
                .send({ name: 'Edited Cafe', submitter_email: 'a@b.co', category_ids: [2] });
            expect(res.statusCode).toBe(200);
            expect(res.body).toMatchObject({ id: 1, name: 'Edited Cafe' });
        });

        it('PUT /submissions/:id should return 404 when no pending submission matches', async () => {
            pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await request(app)
                .put('/submissions/9999')
                .set('Authorization', `Bearer ${makeToken()}`)
                .send({ name: 'Edited Cafe', submitter_email: 'a@b.co' });
            expect(res.statusCode).toBe(404);
        });
    });
});

describe('Ownership', () => {
    it('POST /locations is admin only', async () => {
        const res = await request(app)
            .post('/locations')
            .set('Authorization', `Bearer ${makeToken(30)}`)
            .send({ name: 'New Place', category_ids: [] });
        expect(res.statusCode).toBe(403);
    });

    it('PUT /locations/:id restricts non-admins to their own locations', async () => {
        pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await request(app)
            .put('/locations/1')
            .set('Authorization', `Bearer ${makeToken(30)}`)
            .send({ name: 'Not mine', category_ids: [] });
        expect(res.statusCode).toBe(404);
        const [sql, params] = pool.query.mock.calls[0];
        expect(sql).toContain('AND owner_id = $11');
        expect(params[10]).toBe(30);
    });

    it('PUT /locations/:id lets admins edit any location', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
        await request(app)
            .put('/locations/1')
            .set('Authorization', `Bearer ${makeToken()}`)
            .send({ name: 'Any', category_ids: [] });
        expect(pool.query.mock.calls[0][0]).not.toContain('owner_id');
    });

    it('POST /events records the creating user as owner', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ id: 7 }], rowCount: 1 });
        const res = await request(app)
            .post('/events')
            .set('Authorization', `Bearer ${makeToken(31)}`)
            .send({ title: 'Picnic', event_date: '2030-06-20' });
        expect(res.statusCode).toBe(201);
        expect(pool.query.mock.calls[0][1].at(-1)).toBe(31);
    });

    it('POST /events rejects linking to a business the user does not own', async () => {
        pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await request(app)
            .post('/events')
            .set('Authorization', `Bearer ${makeToken(31)}`)
            .send({ title: 'Picnic', event_date: '2030-06-20', location_id: 2 });
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('code', 'LINKED_LOCATION_NOT_FOUND');
    });

    it('GET /events/all is admin only', async () => {
        const res = await request(app)
            .get('/events/all')
            .set('Authorization', `Bearer ${makeToken(31)}`);
        expect(res.statusCode).toBe(403);
    });
});

describe('Accounts', () => {
    it('rejects tokens from before accounts existed', async () => {
        const legacy = jwt.sign({ username: 'old-admin' }, TEST_JWT_SECRET, { expiresIn: '1h' });
        const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${legacy}`);
        expect(res.statusCode).toBe(401);
    });

    it('GET /auth/me returns the signed-in account', async () => {
        const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${makeToken(40)}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.user).toMatchObject({ id: 40, username: 'user40', isAdmin: false });
    });

    it('POST /auth/register validates its input', async () => {
        const badName = await request(app).post('/auth/register')
            .set('X-Forwarded-For', '198.51.100.1')
            .send({ username: 'x', email: 'a@b.co', password: 'longenough' });
        expect(badName.body).toHaveProperty('code', 'INVALID_USERNAME');

        const shortPw = await request(app).post('/auth/register')
            .set('X-Forwarded-For', '198.51.100.1')
            .send({ username: 'alex', email: 'a@b.co', password: 'short' });
        expect(shortPw.body).toHaveProperty('code', 'PASSWORD_TOO_SHORT');

        const badEmail = await request(app).post('/auth/register')
            .set('X-Forwarded-For', '198.51.100.1')
            .send({ username: 'alex', email: 'nope', password: 'longenough' });
        expect(badEmail.body).toHaveProperty('code', 'A_VALID_EMAIL_REQUIRED');
    });

    it('POST /auth/register rejects a taken username regardless of case', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
        const res = await request(app).post('/auth/register')
            .set('X-Forwarded-For', '198.51.100.2')
            .send({ username: 'Admin', email: 'a@b.co', password: 'longenough' });
        expect(res.statusCode).toBe(409);
        expect(res.body).toHaveProperty('code', 'USERNAME_TAKEN');
    });

    it('POST /auth/password-requests answers the same for unknown usernames', async () => {
        pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await request(app).post('/auth/password-requests')
            .set('X-Forwarded-For', '198.51.100.3')
            .send({ username: 'nobody', new_password: 'longenough' });
        expect(res.statusCode).toBe(202);
        expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('the /users dashboard endpoints are admin only', async () => {
        const res = await request(app).get('/users').set('Authorization', `Bearer ${makeToken(41)}`);
        expect(res.statusCode).toBe(403);
        const anon = await request(app).get('/users/password-requests');
        expect(anon.statusCode).toBe(401);
    });

    it('admins cannot delete their own account', async () => {
        const res = await request(app)
            .delete(`/users/${ADMIN_ID}`)
            .set('Authorization', `Bearer ${makeToken()}`);
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('code', 'CANNOT_DELETE_SELF');
    });
});
