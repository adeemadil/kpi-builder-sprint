#!/bin/bash
# Standalone script to load CSV data into PostgreSQL

set -e

echo "📊 CSV Data Loader"
echo "=================="

# Check if .env exists and load it
if [ -f .env ]; then
    source .env
    echo "✓ Loaded environment from .env"
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set"
    echo ""
    echo "Please provide the database URL:"
    echo "  export DATABASE_URL='postgresql://user:pass@host:port/db'"
    echo "  or add it to .env file"
    exit 1
fi

# Check if CSV file exists
if [ ! -f "public/work-package-raw-data.csv" ]; then
    echo "❌ CSV file not found: public/work-package-raw-data.csv"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.8+"
    exit 1
fi

# Check if psycopg2 is installed
if ! python3 -c "import psycopg2" 2>/dev/null; then
    echo "📦 Installing psycopg2..."
    pip3 install psycopg2-binary
fi

# Run the seed script
echo "🚀 Starting data import..."
python3 seed_postgres.py "$DATABASE_URL"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Data loaded successfully!"
    
    # Update .env if it exists
    if [ -f .env ]; then
        sed -i.bak 's/DATA_LOADED=false/DATA_LOADED=true/' .env
        rm .env.bak 2>/dev/null || true
        echo "✓ Updated .env (DATA_LOADED=true)"
    fi
else
    echo ""
    echo "❌ Data load failed"
    exit 1
fi
