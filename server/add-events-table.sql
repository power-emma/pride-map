-- Migration: add the `events` table backing the "Happening in <city>" cards
-- shown on the main map. Run this against an existing pridemap database that
-- was created before events existed:
--
--   psql -U pridemap -d pridemap -f server/add-events-table.sql
--
-- Safe to run more than once (uses IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_time TIME,
    location VARCHAR(255),
    city VARCHAR(255) NOT NULL DEFAULT 'Ottawa',
    url VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup of the upcoming-events queue shown on the map
CREATE INDEX IF NOT EXISTS events_date_idx ON events (event_date);
