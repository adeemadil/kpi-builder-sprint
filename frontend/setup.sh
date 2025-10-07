#!/bin/bash
# Setup script for KPI Dashboard (Linux/Mac)

set -e

echo "🚀 KPI Dashboard Setup"
echo "======================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your DATABASE_URL"
    echo "   Then run this script again."
    exit 1
fi

# Load environment variables
source .env

echo "✓ Environment variables loaded"

# Check if Docker is installed
if command -v docker &> /dev/null; then
    echo "✓ Docker found"
    
    # Ask user which method to use
    read -p "Use Docker? (y/n): " use_docker
    
    if [ "$use_docker" = "y" ]; then
        echo "🐳 Starting with Docker..."
        docker-compose up --build -d
        echo ""
        echo "✅ Application started!"
        echo "   URL: http://localhost:3000"
        echo ""
        echo "📊 To load CSV data, run:"
        echo "   docker-compose exec kpi-dashboard python3 seed_postgres.py"
        exit 0
    fi
fi

# Manual setup
echo "📦 Installing dependencies..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

npm install

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.8+ first."
    exit 1
fi

echo "✓ Dependencies installed"

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install psycopg2-binary

# Load data if not loaded yet
if [ "$DATA_LOADED" != "true" ]; then
    read -p "Load CSV data into database? (y/n): " load_data
    if [ "$load_data" = "y" ]; then
        echo "📊 Loading data..."
        python3 seed_postgres.py "$DATABASE_URL"
        
        # Update .env
        sed -i.bak 's/DATA_LOADED=false/DATA_LOADED=true/' .env
        rm .env.bak
    fi
fi

# Start development server
echo "🚀 Starting development server..."
npm run dev
