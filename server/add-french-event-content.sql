-- Add optional French titles and descriptions to existing events.
--
--   psql -U pridemap -d pridemap -f server/add-french-event-content.sql

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS title_fr VARCHAR(255),
    ADD COLUMN IF NOT EXISTS description_fr TEXT;
