#!/bin/bash

set -euo pipefail

COMPOSE_CMD="docker compose"

echo "🐳 Starting KPI Builder with Docker Compose..."
echo ""

# Build and start services (Docker Compose v2)
$COMPOSE_CMD up --build -d

echo ""
echo "⏳ Waiting for services to be ready..."

# Wait for backend health (up to ~30s)
HEALTH_URL="http://localhost:3001/api/health"
for i in {1..30}; do
  if curl -sf "$HEALTH_URL" >/dev/null; then
    break
  fi
  sleep 1
done

# Check backend health
echo "🔍 Checking backend health..."
if command -v jq >/dev/null 2>&1; then
  curl -s "$HEALTH_URL" | jq . || true
else
  echo "(tip) Install jq for pretty output: brew install jq"
  curl -s "$HEALTH_URL" || true
fi

echo ""
echo "✅ Services started successfully!"
echo ""
echo "📊 Backend API: http://localhost:3001"
echo "🎨 Frontend: http://localhost:5173 (if added to compose)"
echo "🗄️  Database: postgresql://kpi_user:kpi_password@localhost:5432/kpi_builder"
echo ""
echo "📝 View logs: $COMPOSE_CMD logs -f"
echo "🛑 Stop services: $COMPOSE_CMD down"
echo "🔄 Restart: $COMPOSE_CMD restart"


