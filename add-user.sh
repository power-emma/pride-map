#!/usr/bin/env bash
# add-user.sh — Add or update an admin user for the Pride Map manage page.
#
# Usage:
#   ./add-user.sh <username>
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
if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <username>" >&2
  exit 1
fi

USERNAME="$1"

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
export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGDATABASE="${PGDATABASE:-pridemap}"
export PGUSER="${PGUSER:-pridemap}"

# PGPASSWORD can be set in the environment before calling this script.
# We pass the username and hash via a Node.js helper so that bcrypt's special
# characters ($, /, etc.) are never interpreted by the shell or psql variable
# substitution — they go straight into a parameterised query.
cd "$SERVER_DIR" && node -e "
const { Client } = require('pg');
const client = new Client();
client.connect()
  .then(() => client.query(
    \`INSERT INTO admin_users (username, password_hash)
     VALUES (\\\$1, \\\$2)
     ON CONFLICT (username)
     DO UPDATE SET password_hash = EXCLUDED.password_hash\`,
    [process.argv[1], process.argv[2]]
  ))
  .then(() => { console.log('User saved.'); return client.end(); })
  .catch(e => { console.error(e.message); process.exit(1); });
" "$USERNAME" "$HASH"

echo "✓ User '$USERNAME' saved successfully."


echo "✓ User '$USERNAME' saved successfully."
