-- Migration: add the `submissions` table for the public business-submission
-- queue. Run this against an existing pridemap database that was created before
-- submissions existed:
--
--   psql -U pridemap -d pridemap -f server/add-submissions-table.sql
--
-- Safe to run more than once (uses IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    url VARCHAR(255),
    submitter_email VARCHAR(255) NOT NULL,
    category_ids INTEGER[] NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | rejected
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions (status, created_at);
