#!/bin/bash

set -euo pipefail

echo "🐳 Starting KPI Builder with Docker Compose..."
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

COMPOSE_CMD="docker compose"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

echo "🔨 Building and starting services..."
$COMPOSE_CMD up --build -d

echo ""
echo "⏳ Waiting for backend to be ready..."

# Wait for backend health (up to ~60s for initial seeding)
HEALTH_URL="http://localhost:3001/api/health"
for i in {1..60}; do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is ready!${NC}"
    break
  fi
  if [[ $i -eq 60 ]]; then
    echo "❌ Backend failed to start within 60 seconds"
    echo "📝 Check logs with: docker compose logs backend"
    exit 1
  fi
  echo -n "."
  sleep 1
done

# Check backend health and show info
echo ""
echo "🔍 Backend Health Check:"
if command -v jq >/dev/null 2>&1; then
  curl -s "$HEALTH_URL" | jq . || true
else
  echo "(tip) Install jq for pretty output: brew install jq"
  curl -s "$HEALTH_URL" || true
fi

echo ""
echo -e "${GREEN}✅ KPI Builder started successfully!${NC}"
echo ""
echo "📊 Backend API: http://localhost:3001"
echo "🎨 Frontend: Run ./scripts/start-frontend.sh to start the frontend"
echo "🗄️  Database: SQLite (persisted in Docker volume)"
echo ""
echo "📝 Useful Commands:"
echo "  View logs: $COMPOSE_CMD logs -f"
echo "  Stop services: $COMPOSE_CMD down"
echo "  Restart: $COMPOSE_CMD restart"
echo "  Run tests: cd backend && npm test"
echo ""
echo "🚀 Next Steps:"
echo "  1. Start frontend: ./scripts/start-frontend.sh"
echo "  2. Open browser: http://localhost:5173"
echo "  3. Run tests: cd backend && npm test"


