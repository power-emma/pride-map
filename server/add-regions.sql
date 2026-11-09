-- Region support. Existing content defaults to Ottawa; the two Toronto
-- locations are moved explicitly after the default backfill.

CREATE TABLE IF NOT EXISTS regions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS regions_name_lower_idx ON regions (LOWER(name));

CREATE TABLE IF NOT EXISTS region_admins (
    region_id INTEGER NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (region_id, user_id)
);

ALTER TABLE locations ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES regions(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES regions(id) ON DELETE CASCADE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES regions(id) ON DELETE CASCADE;

INSERT INTO regions (name) VALUES ('Ottawa'), ('Toronto')
ON CONFLICT DO NOTHING;

UPDATE locations
SET region_id = (SELECT id FROM regions WHERE LOWER(name) = 'ottawa')
WHERE region_id IS NULL;

CREATE TABLE IF NOT EXISTS region_migrations (
    name VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM region_migrations WHERE name = 'toronto-location-backfill'
    ) THEN
        UPDATE locations
        SET region_id = (SELECT id FROM regions WHERE LOWER(name) = 'toronto')
        WHERE LOWER(name) IN ('francoqueer', 'human rights legal support centre');

        INSERT INTO region_migrations (name) VALUES ('toronto-location-backfill');
    END IF;
END
$$;

UPDATE events
SET region_id = (SELECT id FROM regions WHERE LOWER(name) = 'ottawa')
WHERE region_id IS NULL;

UPDATE submissions
SET region_id = (SELECT id FROM regions WHERE LOWER(name) = 'ottawa')
WHERE region_id IS NULL;

ALTER TABLE locations ALTER COLUMN region_id SET NOT NULL;
ALTER TABLE events ALTER COLUMN region_id SET NOT NULL;
ALTER TABLE submissions ALTER COLUMN region_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS locations_region_idx ON locations (region_id);
CREATE INDEX IF NOT EXISTS events_region_idx ON events (region_id);
CREATE INDEX IF NOT EXISTS submissions_region_idx ON submissions (region_id);
CREATE INDEX IF NOT EXISTS region_admins_user_idx ON region_admins (user_id);
