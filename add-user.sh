#!/usr/bin/env bash
# add-user.sh — Add an admin account, or promote/reset an existing account.
#
# Usage:
#   ./add-user.sh <username> [email]
#
# Regular accounts sign up from the website; use this to bootstrap admins.
# If the username already exists its password is replaced and it is made an
# admin (its email is only changed when one is given).
#
# The script will prompt for a password (input is hidden).
# Passwords are hashed with bcrypt (cost factor 12) before being stored;
# plain-text passwords are never written to disk or the database.
#
# Prerequisites:
#   - Node.js with 'bcrypt' installed in server/node_modules  (npm install inside server/)
#   - psql available, with the pridemap database accessible via the environment
#     variables below (or the defaults).
#
# Environment variables (all optional — defaults match database.sql setup):
#   PGHOST      — default: localhost
#   PGPORT      — default: 5432
#   PGDATABASE  — default: pridemap
#   PGUSER      — default: pridemap
#   PGPASSWORD  — set this to avoid an interactive prompt from psql

set -euo pipefail

# ── Locate script's own directory so we can find server/node_modules ──────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"

# ── Argument check ─────────────────────────────────────────────────────────────
if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <username> [email]" >&2
  exit 1
fi

USERNAME="$1"
EMAIL="${2:-}"

if [[ -z "$USERNAME" ]]; then
  echo "Error: username must not be empty." >&2
  exit 1
fi

# ── Read password securely (no echo) ──────────────────────────────────────────
read -r -s -p "Password for '$USERNAME': " PASSWORD
echo
read -r -s -p "Confirm password: " PASSWORD_CONFIRM
echo

if [[ "$PASSWORD" != "$PASSWORD_CONFIRM" ]]; then
  echo "Error: passwords do not match." >&2
  exit 1
fi

if [[ ${#PASSWORD} -lt 8 ]]; then
  echo "Error: password must be at least 8 characters." >&2
  exit 1
fi

# ── Hash the password with bcrypt via Node.js ──────────────────────────────────
HASH=$(cd "$SERVER_DIR" && node -e "
const bcrypt = require('bcrypt');
bcrypt.hash(process.argv[1], 12).then(h => { process.stdout.write(h); }).catch(e => { process.stderr.write(e.message); process.exit(1); });
" "$PASSWORD" 2>&1)

if [[ $? -ne 0 ]]; then
  echo "Error hashing password: $HASH" >&2
  exit 1
fi

# Clear the plain-text password from memory as soon as we're done with it
PASSWORD=""
PASSWORD_CONFIRM=""

# ── Upsert into the database ───────────────────────────────────────────────────
# Credentials are passed explicitly to Node so the script works with or without
# sudo and regardless of whether PGPASSWORD is set in the environment.
cd "$SERVER_DIR" && node -e "
const { Client } = require('pg');
const client = new Client({
  host:     process.env.PGHOST     || 'localhost',
  port:     process.env.PGPORT     || 5432,
  database: process.env.PGDATABASE || 'pridemap',
  user:     process.env.PGUSER     || 'pridemap',
  password: process.env.PGPASSWORD || 'Postgres!',
});
client.connect()
  .then(() => client.query(
    \`INSERT INTO users (username, password_hash, email, is_admin)
     VALUES (\\\$1, \\\$2, NULLIF(\\\$3, ''), TRUE)
     ON CONFLICT (username)
     DO UPDATE SET password_hash = EXCLUDED.password_hash,
                   email = COALESCE(EXCLUDED.email, users.email),
                   is_admin = TRUE,
                   password_changed_at = NOW()\`,
    [process.argv[1], process.argv[2], process.argv[3]]
  ))
  .then(() => { console.log('User saved.'); return client.end(); })
  .catch(e => { console.error(e.message); process.exit(1); });
" "$USERNAME" "$HASH" "$EMAIL"

echo "✓ Admin '$USERNAME' saved successfully."
