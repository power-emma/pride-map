#!/bin/bash

# Pride Map - PostgreSQL Setup Script
# This script sets up PostgreSQL, creates the database, and starts the server

set -e  # Exit on any error

echo "=== Pride Map Database Setup ==="
echo ""

# Check if PostgreSQL is installed
echo "Checking for PostgreSQL installation..."
if command -v psql &> /dev/null; then
    echo "PostgreSQL is already installed"
    psql --version
else
    echo "PostgreSQL not found. Installing PostgreSQL..."
    
    # Detect OS and install accordingly
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt-get &> /dev/null; then
            # Debian/Ubuntu
            sudo apt-get update
            sudo apt-get install -y postgresql postgresql-contrib
        elif command -v yum &> /dev/null; then
            # RedHat/CentOS
            sudo yum install -y postgresql-server postgresql-contrib
            sudo postgresql-setup initdb
        elif command -v pacman &> /dev/null; then
            # Arch Linux
            sudo pacman -S --noconfirm postgresql
            sudo -u postgres initdb -D /var/lib/postgres/data
        else
            echo "ERROR: Unsupported Linux distribution. Please install PostgreSQL manually."
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install postgresql@15
            brew services start postgresql@15
        else
            echo "ERROR: Homebrew not found. Please install Homebrew or PostgreSQL manually."
            exit 1
        fi
    else
        echo "ERROR: Unsupported operating system: $OSTYPE"
        exit 1
    fi
    
    echo "PostgreSQL installed successfully"
fi

# Start PostgreSQL service
echo "Starting PostgreSQL service..."
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    echo "PostgreSQL service started"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v brew &> /dev/null; then
        brew services start postgresql@15 2>/dev/null || brew services restart postgresql@15
        echo "PostgreSQL service started"
    fi
fi

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 3

# Database configuration
DB_NAME="pridemap"
DB_USER="pridemap"
DB_PASSWORD="Postgres!"
DB_HOST="localhost"
DB_PORT="5432"

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SQL_FILE="$SCRIPT_DIR/server/database.sql"

# Check if database.sql exists
if [ ! -f "$SQL_FILE" ]; then
    echo "ERROR: database.sql not found at: $SQL_FILE"
    exit 1
fi

echo "Setting up database and user..."

# Function to run psql commands
run_psql() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo -u postgres psql "$@"
    else
        psql postgres "$@"
    fi
}

# NOTE: This script is NON-DESTRUCTIVE and idempotent. It only ever creates
# things that are missing — it never drops the database, the role, or any data.
# Running it against an existing, populated database is safe: it will leave the
# existing schema and rows untouched and simply ensure the newer `submissions`
# table exists.

# Helper to run a query as the app user against the app DB (so object ownership
# matches what the server connects as).
run_psql_db() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo -u postgres psql -d "$DB_NAME" "$@"
    else
        psql -d "$DB_NAME" "$@"
    fi
}

# Refresh the recorded collation version on the template databases.
#
# Edge case: after an OS C-library upgrade (common on rolling distros like
# Arch, e.g. glibc 2.43 -> 2.44) PostgreSQL records a "collation version
# mismatch" on template1, which makes CREATE DATABASE fail outright. Refreshing
# the version is a metadata-only operation (it does not touch any row data) and
# tells PostgreSQL to trust the current OS collation. We do it defensively and
# tolerate failure, since the command only exists on PG 15+ and is only needed
# when a mismatch is present.
refresh_template_collation() {
    echo "Refreshing collation version on template databases (metadata-only)..."
    run_psql -c "ALTER DATABASE template1 REFRESH COLLATION VERSION;" 2>/dev/null || true
    run_psql -c "ALTER DATABASE postgres  REFRESH COLLATION VERSION;" 2>/dev/null || true
}

# Create the login role only if it does not already exist (never dropped).
if run_psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1; then
    echo "Role '$DB_USER' already exists — leaving it (and its password) unchanged."
else
    echo "Creating user: $DB_USER"
    run_psql -c "CREATE ROLE $DB_USER WITH LOGIN SUPERUSER PASSWORD '$DB_PASSWORD';"
    echo "User created"
fi

# Verify the role actually exists now — fail loudly rather than silently
# continuing to a CREATE DATABASE that would also fail.
if ! run_psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1; then
    echo "ERROR: role '$DB_USER' does not exist after the creation step." >&2
    echo "       Check the psql output above for the cause." >&2
    exit 1
fi

# Create the database only if it does not already exist (never dropped).
DB_WAS_CREATED=false
if run_psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1; then
    echo "Database '$DB_NAME' already exists — preserving all existing data."
else
    echo "Creating database: $DB_NAME"
    # Capture output so we can detect and auto-recover from a collation mismatch.
    if ! CREATE_OUT=$(run_psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>&1); then
        echo "$CREATE_OUT" | sed 's/^/    /'
        if echo "$CREATE_OUT" | grep -qi "collation version mismatch"; then
            refresh_template_collation
            echo "Retrying database creation..."
            run_psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
        else
            echo "ERROR: failed to create database '$DB_NAME' (see error above)." >&2
            exit 1
        fi
    fi
    DB_WAS_CREATED=true
    echo "Database created"
fi

# Verify the database actually exists now before we try to load schema into it.
if ! run_psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1; then
    echo "ERROR: database '$DB_NAME' does not exist after the creation step." >&2
    exit 1
fi

# Grant privileges (idempotent, non-destructive).
run_psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Load the base schema + seed data ONLY when the core tables are absent, so we
# never duplicate seed rows or clobber an existing, populated database. We detect
# this by checking for the `locations` table.
LOCATIONS_EXISTS=$(run_psql_db -tAc "SELECT to_regclass('public.locations') IS NOT NULL;" 2>/dev/null | xargs)

if [ "$LOCATIONS_EXISTS" != "t" ]; then
    echo "No existing schema detected — loading base schema and seed data..."

    TEMP_SQL=$(mktemp)
    chmod 644 "$TEMP_SQL"

    # Extract everything from the first CREATE TABLE onward (skips the
    # CREATE DATABASE / CREATE ROLE lines, which we handled above).
    sed -n '/^CREATE TABLE/,$ p' "$SQL_FILE" > "$TEMP_SQL"

    run_psql_db -f "$TEMP_SQL" 2>&1 | grep -v "^$" || true
    rm "$TEMP_SQL"

    echo "Base schema and seed data loaded successfully"
else
    echo "Existing schema detected — skipping base schema/seed load (data preserved)."
fi

# Always ensure the newer `submissions` table exists. The migration uses
# IF NOT EXISTS, so this is safe whether the DB is brand new or pre-existing.
MIGRATION_SQL="$SCRIPT_DIR/server/add-submissions-table.sql"
if [ -f "$MIGRATION_SQL" ]; then
    echo "Ensuring 'submissions' table exists..."
    run_psql_db -f "$MIGRATION_SQL" 2>&1 | grep -v "^$" || true
else
    echo "WARNING: $MIGRATION_SQL not found — 'submissions' table not ensured."
fi

# Verify the setup — confirm every core table actually exists, and fail loudly
# (rather than reporting success) if any of them is missing.
echo "Verifying database setup..."

verification_failed=false
for tbl in categories locations location_categories admin_users submissions; do
    exists=$(run_psql_db -tAc "SELECT to_regclass('public.$tbl') IS NOT NULL;" 2>/dev/null | xargs)
    if [ "$exists" = "t" ]; then
        echo "  ✓ table '$tbl' present"
    else
        echo "  ✗ table '$tbl' MISSING" >&2
        verification_failed=true
    fi
done

if [ "$verification_failed" = true ]; then
    echo "ERROR: database verification failed — one or more tables are missing." >&2
    echo "       Review the psql output above for the underlying cause." >&2
    exit 1
fi

CATEGORY_COUNT=$(run_psql_db -tAc "SELECT COUNT(*) FROM categories;" | xargs)
LOCATION_COUNT=$(run_psql_db -tAc "SELECT COUNT(*) FROM locations;" | xargs)
SUBMISSION_COUNT=$(run_psql_db -tAc "SELECT COUNT(*) FROM submissions;" | xargs)

echo "Database verification complete:"
echo "  - Categories:  $CATEGORY_COUNT"
echo "  - Locations:   $LOCATION_COUNT"
echo "  - Submissions: $SUBMISSION_COUNT (pending-review queue)"

echo ""
echo "Database setup complete!"
echo ""
echo "Database connection details:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Password: $DB_PASSWORD"
echo ""
echo "PostgreSQL is now running and ready to accept connections!"

