-- Add optional French display names and descriptions to live locations and
-- pending submissions. Existing name and description values remain English.
--
--   psql -U pridemap -d pridemap -f server/add-french-location-content.sql

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS name_fr VARCHAR(255),
    ADD COLUMN IF NOT EXISTS description_fr TEXT;

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS name_fr VARCHAR(255),
    ADD COLUMN IF NOT EXISTS description_fr TEXT;
