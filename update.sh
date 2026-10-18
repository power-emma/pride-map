#!/usr/bin/env bash
# update.sh — Upgrade an existing Pride Map deployment in place, keeping all data.
#
# Written for servers running commit cf1034a ("mobile fixes"), whose database
# only has categories, locations, location_categories and admin_users, but it
# is safe on any later version too: every migration only adds tables/columns
# and skips whatever already exists.
#
# Usage (from the repo root, after pulling the new code):
#   git pull
#   ./update.sh            # back up, migrate, install deps, build the client
#   ./update.sh --check    # dry run: apply the migrations, then roll back
#   ./update.sh --restart  # as the default, then restart via run-servers.sh
#   ./update.sh --rollback backups/pre-update_<timestamp>.dump
#                          # put the database back to a pre-update backup
#
# What it does:
#   1. Takes a full pg_dump backup to backups/pre-update_<timestamp>.dump and
#      refuses to continue if that fails.
#   2. Applies every migration in one transaction — all of them or none.
#   3. Confirms no existing rows were lost and every admin login carried over.
#   4. Installs npm dependencies and builds the client, so a broken build is
#      caught before the live server is restarted.
#
# The old server can keep running throughout: the migrations only add things,
# so the old code keeps working until you restart onto the new code.
#
# Database settings match run-servers.sh and can be overridden the same way:
#   DB_USER DB_NAME DB_HOST DB_PORT DB_PASS

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client/pridemap"
LOG_DIR="$ROOT_DIR/logs"
BACKUP_DIR="$ROOT_DIR/backups"

DB_USER="${DB_USER:-pridemap}"
DB_NAME="${DB_NAME:-pridemap}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_PASS="${DB_PASS:-Postgres!}"
export PGPASSWORD="$DB_PASS"

# Order matters: later migrations alter tables created by earlier ones.
MIGRATIONS=(
  add-submissions-table.sql
  add-french-location-content.sql
  add-events-table.sql
  add-french-event-content.sql
  add-image-columns.sql
  add-image-blob-columns.sql
  add-user-accounts.sql
)

MODE=update
case "${1:-}" in
  "") ;;
  --check) MODE=check ;;
  --restart) MODE=restart ;;
  --rollback) MODE=rollback; ROLLBACK_FILE="${2:-}" ;;
  -h|--help) sed -n '2,33p' "$0"; exit 0 ;;
  *) echo "Unknown option: $1 (try --help)" >&2; exit 1 ;;
esac

step() { echo; echo "==> $*"; }
fail() { echo "ERROR: $*" >&2; exit 1; }

psql_db() {
  psql -X -q -v ON_ERROR_STOP=1 -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" "$@"
}
scalar() { psql_db -tAc "$1"; }
table_exists() { [[ "$(scalar "SELECT to_regclass('public.$1') IS NOT NULL")" == "t" ]]; }
psql_admin() {
  psql -X -q -v ON_ERROR_STOP=1 -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d postgres "$@"
}

# ---------------------------------------------------------------------------
# --rollback: restore a pre-update backup.
#
# A plain `pg_restore --clean` can't do this, because the dump doesn't know
# about the tables the upgrade added (which reference `locations`). Instead
# the backup is restored into a brand-new database, and only once that
# succeeds is it swapped in. The upgraded database is renamed, not dropped,
# so anything created since the update can still be recovered from it.
# ---------------------------------------------------------------------------
if [[ "$MODE" == rollback ]]; then
  [[ -n "$ROLLBACK_FILE" && -f "$ROLLBACK_FILE" ]] || fail "Usage: $0 --rollback backups/pre-update_<timestamp>.dump"
  pg_restore --list "$ROLLBACK_FILE" >/dev/null 2>&1 || fail "$ROLLBACK_FILE is not a readable pg_dump backup."

  ts="$(date +%Y%m%d_%H%M%S)"
  RESTORE_DB="${DB_NAME}_restore_$ts"
  KEPT_DB="${DB_NAME}_before_rollback_$ts"

  step "Restoring $ROLLBACK_FILE into a new database ($RESTORE_DB)"
  psql_admin -c "CREATE DATABASE \"$RESTORE_DB\" OWNER \"$DB_USER\""
  if ! pg_restore --no-owner --role="$DB_USER" -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$RESTORE_DB" "$ROLLBACK_FILE"; then
    psql_admin -c "DROP DATABASE IF EXISTS \"$RESTORE_DB\"" || true
    fail "Restore failed — the current database was not touched."
  fi

  step "Swapping it in"
  echo "Stop the Node server first if you can; any open connections to '$DB_NAME' will be closed."
  psql_admin -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid()" >/dev/null
  psql_admin -c "ALTER DATABASE \"$DB_NAME\" RENAME TO \"$KEPT_DB\""
  psql_admin -c "ALTER DATABASE \"$RESTORE_DB\" RENAME TO \"$DB_NAME\""

  echo
  echo "Rolled back: '$DB_NAME' now holds the contents of $ROLLBACK_FILE."
  echo "The upgraded database was kept as '$KEPT_DB'. Once you're sure you don't need it:"
  echo "  PGPASSWORD='$DB_PASS' psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d postgres -c 'DROP DATABASE \"$KEPT_DB\"'"
  echo "Remember to also check out the old code (git checkout cf1034a) before restarting."
  exit 0
fi

# Row counts of every table that exists, as "table=count" lines.
snapshot_counts() {
  local tbl
  for tbl in categories locations location_categories admin_users submissions events users password_change_requests; do
    if table_exists "$tbl"; then
      echo "$tbl=$(scalar "SELECT COUNT(*) FROM $tbl")"
    fi
  done
}

# ---------------------------------------------------------------------------
step "Pre-flight checks"
# ---------------------------------------------------------------------------

for cmd in psql pg_dump npm node; do
  command -v "$cmd" >/dev/null 2>&1 || fail "'$cmd' is not installed or not on PATH."
done

for migration in "${MIGRATIONS[@]}"; do
  [[ -f "$SERVER_DIR/$migration" ]] || fail "server/$migration is missing — pull the new code before running this."
done

scalar "SELECT 1" >/dev/null 2>&1 \
  || fail "Cannot connect to database '$DB_NAME' as '$DB_USER' on $DB_HOST:$DB_PORT."

table_exists locations \
  || fail "Database '$DB_NAME' has no 'locations' table. This is for upgrading an existing install; use ./setup-db.sh for a new one."

echo "Connected to '$DB_NAME' on $DB_HOST:$DB_PORT."
BEFORE="$(snapshot_counts)"
echo "Current row counts:"
sed 's/^/  /' <<<"$BEFORE"

# ---------------------------------------------------------------------------
if [[ "$MODE" != check ]]; then
  step "Backing up the database"
  # -------------------------------------------------------------------------
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/pre-update_$(date +%Y%m%d_%H%M%S).dump"
  # Custom format, so it can be restored with pg_restore (see the end of this script).
  pg_dump -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -Fc -f "$BACKUP_FILE" "$DB_NAME" \
    || { rm -f "$BACKUP_FILE"; fail "pg_dump failed — nothing was changed."; }
  # Make sure the dump is readable, not just present.
  pg_restore --list "$BACKUP_FILE" >/dev/null 2>&1 \
    || fail "Backup $BACKUP_FILE could not be read back — nothing was changed."
  echo "Backup written: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
fi

# ---------------------------------------------------------------------------
step "Applying migrations$([[ "$MODE" == check ]] && echo " (dry run — will roll back)")"
# ---------------------------------------------------------------------------

# One transaction around every migration: if any statement fails, psql stops
# and the whole upgrade is rolled back, leaving the database untouched.
MIGRATION_SCRIPT="$(mktemp)"
trap 'rm -f "$MIGRATION_SCRIPT"' EXIT
{
  echo "SET client_min_messages = warning;"
  echo "BEGIN;"
  for migration in "${MIGRATIONS[@]}"; do
    echo "\\echo '  - $migration'"
    echo "\\i '$SERVER_DIR/$migration'"
  done
  if [[ "$MODE" == check ]]; then
    echo "ROLLBACK;"
  else
    echo "COMMIT;"
  fi
} > "$MIGRATION_SCRIPT"

psql_db -f "$MIGRATION_SCRIPT" \
  || fail "A migration failed and everything was rolled back — the database is unchanged."

if [[ "$MODE" == check ]]; then
  echo
  echo "Dry run succeeded: all migrations apply cleanly. Nothing was changed."
  exit 0
fi

# ---------------------------------------------------------------------------
step "Verifying"
# ---------------------------------------------------------------------------

AFTER="$(snapshot_counts)"
problems=0

# Every table that existed before must still have exactly as many rows.
while IFS='=' read -r tbl before_count; do
  [[ -z "$tbl" ]] && continue
  after_count="$(grep "^$tbl=" <<<"$AFTER" | cut -d= -f2)"
  if [[ "$after_count" != "$before_count" ]]; then
    echo "  ✗ $tbl: $before_count rows before, ${after_count:-none} after" >&2
    problems=1
  else
    echo "  ✓ $tbl: $after_count rows"
  fi
done <<<"$BEFORE"

# Every old admin login must now exist as an admin account.
missing_admins="$(scalar "SELECT COUNT(*) FROM admin_users a WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.username = a.username AND u.is_admin)")"
if [[ "$missing_admins" != "0" ]]; then
  echo "  ✗ $missing_admins admin login(s) were not carried over to the new accounts table" >&2
  problems=1
else
  echo "  ✓ all $(scalar "SELECT COUNT(*) FROM admin_users") admin login(s) carried over as admin accounts"
fi

for tbl in users password_change_requests submissions events; do
  table_exists "$tbl" || { echo "  ✗ table '$tbl' missing" >&2; problems=1; }
done
for column in locations.owner_id events.owner_id submissions.user_id locations.image_data events.title_fr; do
  exists="$(scalar "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${column%%.*}' AND column_name = '${column#*.}')")"
  [[ "$exists" == "t" ]] || { echo "  ✗ column '$column' missing" >&2; problems=1; }
done

if [[ "$problems" -ne 0 ]]; then
  echo >&2
  echo "Verification FAILED. To put the database back exactly as it was:" >&2
  echo "  ./update.sh --rollback '$BACKUP_FILE'" >&2
  exit 1
fi
echo "Database upgraded with no data lost."

# ---------------------------------------------------------------------------
step "Installing dependencies and building the client"
# ---------------------------------------------------------------------------

mkdir -p "$LOG_DIR"
(cd "$SERVER_DIR" && npm install --no-audit --no-fund) > "$LOG_DIR/server-install.log" 2>&1 \
  || fail "npm install failed for the server — see $LOG_DIR/server-install.log. The database is already upgraded; the old server is still running."
echo "  ✓ server dependencies"
(cd "$CLIENT_DIR" && npm install --no-audit --no-fund) > "$LOG_DIR/client-install.log" 2>&1 \
  || fail "npm install failed for the client — see $LOG_DIR/client-install.log. The database is already upgraded; the old server is still running."
echo "  ✓ client dependencies"
(cd "$CLIENT_DIR" && npm run build) > "$LOG_DIR/client-build.log" 2>&1 \
  || { tail -n 30 "$LOG_DIR/client-build.log" >&2; fail "Client build failed — see $LOG_DIR/client-build.log."; }
echo "  ✓ client build"

# ---------------------------------------------------------------------------
step "Done"
# ---------------------------------------------------------------------------

cat <<EOF
Backup: $BACKUP_FILE
To undo the database upgrade:
  ./update.sh --rollback '$BACKUP_FILE'

Notes:
  - Existing admins keep their usernames and passwords, but must sign in
    again: sessions from the old version are no longer accepted.
  - The CAPTCHA is gone; TURNSTILE_SECRET_KEY / VITE_TURNSTILE_SITE_KEY are
    no longer used and can be removed from the environment.
EOF

if [[ "$MODE" == restart ]]; then
  echo
  echo "Restarting onto the new code..."
  # Stop the old watchdog first so it can't respawn the old server, then let
  # run-servers.sh clear the ports and start everything fresh.
  for pidfile in watchdog.pid backup.pid server.pid; do
    if [[ -f "$LOG_DIR/$pidfile" ]]; then
      pid="$(cat "$LOG_DIR/$pidfile" 2>/dev/null || true)"
      [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
      rm -f "$LOG_DIR/$pidfile"
    fi
  done
  exec "$ROOT_DIR/run-servers.sh"
else
  echo
  echo "The old server is still running. To switch to the new code, either press 'r'"
  echo "in your run-servers.sh session, or run: ./update.sh --restart"
fi
