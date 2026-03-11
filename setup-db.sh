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

# Drop existing database if it exists (for clean setup)
echo "Checking for existing database..."
run_psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 && {
    echo "Dropping existing database..."
    run_psql -c "DROP DATABASE IF EXISTS $DB_NAME;"
}

# Drop existing user if it exists
run_psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1 && {
    echo "Dropping existing user..."
    run_psql -c "DROP ROLE IF EXISTS $DB_USER;"
}

# Create database
echo "Creating database: $DB_NAME"
run_psql -c "CREATE DATABASE $DB_NAME;"
echo "Database created"

# Create user with password
echo "Creating user: $DB_USER"
run_psql -c "CREATE ROLE $DB_USER WITH LOGIN SUPERUSER PASSWORD '$DB_PASSWORD';"
echo "User created"

# Grant privileges
run_psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Execute SQL file - extract and run only the table/data creation parts
echo "Loading database schema and data..."

# Create a temporary SQL file with only the necessary commands
TEMP_SQL=$(mktemp)
chmod 644 "$TEMP_SQL"

# Extract everything after the CREATE DATABASE commands
# Skip the initial comments and database/role creation commands
sed -n '/^CREATE TABLE/,$ p' "$SQL_FILE" > "$TEMP_SQL"

# Execute the SQL commands
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo -u postgres psql -d "$DB_NAME" -f "$TEMP_SQL" 2>&1 | grep -v "^$" || true
else
    psql -d "$DB_NAME" -f "$TEMP_SQL" 2>&1 | grep -v "^$" || true
fi

# Clean up temporary file
rm "$TEMP_SQL"

echo "Database schema and data loaded successfully"

# Verify the setup
echo "Verifying database setup..."
CATEGORY_COUNT=$(run_psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM categories;" | xargs)
LOCATION_COUNT=$(run_psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM locations;" | xargs)

echo "Database verification complete:"
echo "  - Categories: $CATEGORY_COUNT"
echo "  - Locations: $LOCATION_COUNT"

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

