-- Migration: public user accounts. Anyone can register; uploading a location
-- or event now requires an account, and each account manages its own content.
-- Admins are users with is_admin = TRUE. Run this against an existing pridemap
-- database that predates accounts:
--
--   psql -U pridemap -d pridemap -f server/add-user-accounts.sql
--
-- Safe to run more than once (uses IF NOT EXISTS / ON CONFLICT).

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    -- Optional only so add-user.sh can create admins without one; the public
    -- registration form always requires it.
    email VARCHAR(255),
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Tokens issued before this moment are rejected, so an approved password
    -- change signs the account out everywhere.
    password_changed_at TIMESTAMPTZ
);

-- Carry the existing manage-page logins over as admins.
INSERT INTO users (username, password_hash, is_admin, created_at)
SELECT username, password_hash, TRUE, created_at FROM admin_users
ON CONFLICT (username) DO NOTHING;

-- Who owns each piece of content. NULL means admin-managed (seed data, or
-- created by an admin). Deleting an account keeps its live content unless the
-- admin chooses to delete it too.
ALTER TABLE locations ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- The submitter's email now comes from their account, which may not have one.
ALTER TABLE submissions ALTER COLUMN submitter_email DROP NOT NULL;

CREATE INDEX IF NOT EXISTS locations_owner_idx ON locations (owner_id);
CREATE INDEX IF NOT EXISTS events_owner_idx ON events (owner_id);
CREATE INDEX IF NOT EXISTS submissions_user_idx ON submissions (user_id);

-- Password changes only take effect once an admin approves them. The new
-- password is hashed on request, so the plain text is never stored.
CREATE TABLE IF NOT EXISTS password_change_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | denied
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS password_change_requests_status_idx ON password_change_requests (status, created_at);
