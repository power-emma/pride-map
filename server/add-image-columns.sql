-- Migration: add image support to locations (pins) and events, plus the
-- link from an event to the business hosting it (used to fall back to the
-- business's image when the event has none of its own). Run this against an
-- existing pridemap database that predates image support:
--
--   psql -U pridemap -d pridemap -f server/add-image-columns.sql
--
-- Safe to run more than once (uses IF NOT EXISTS).

ALTER TABLE locations ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS events_location_id_idx ON events (location_id);
