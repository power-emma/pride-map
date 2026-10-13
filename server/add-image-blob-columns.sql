-- Migration: allow uploading an image directly to the server (stored as a
-- BLOB in Postgres) for locations (pins), events, and pending submissions,
-- as an alternative to linking an external image_url. Run this against an
-- existing pridemap database that predates blob uploads:
--
--   psql -U pridemap -d pridemap -f server/add-image-blob-columns.sql
--
-- Safe to run more than once (uses IF NOT EXISTS).

ALTER TABLE locations ADD COLUMN IF NOT EXISTS image_data BYTEA;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS image_mime_type VARCHAR(100);

ALTER TABLE events ADD COLUMN IF NOT EXISTS image_data BYTEA;
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_mime_type VARCHAR(100);

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS image_data BYTEA;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS image_mime_type VARCHAR(100);
