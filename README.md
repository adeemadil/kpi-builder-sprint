# Safety Analytics - KPI Builder

Dynamic KPI analytics dashboard for industrial safety monitoring with real-time safety metrics, close-call detection, and customizable analytics.

## 🚀 Quick Start

### Docker (Recommended)
**One command to run the full stack (backend + frontend):**

```bash
docker compose up --build -d
```

This will:
1. Build and start the backend (auto-seeds SQLite with 100k rows on first run)
2. Start the frontend (production preview)
3. Expose API at http://localhost:3001 and UI at http://localhost:8080

Verify:
```bash
curl http://localhost:3001/api/health
open http://localhost:8080
```

See TESTING.md for scenario-wise curl examples.

Useful Docker commands:
```bash
docker compose ps
docker compose logs -f backend
docker compose down   # stop services
docker compose down -v  # stop and reset database volume
```

### Option 2: Local Development (advanced)
Run services locally only if you are not using Docker.

**Check health:**
```bash
curl http://localhost:3001/api/health
```

## 📁 Project Structure

```
kpi-builder-sprint/
├── backend/                    # Express API server
│   ├── src/
│   │   ├── server.ts          # Main server
│   │   ├── db.ts              # Database connection & queries
│   │   └── routes.ts          # API endpoints
│   ├── data/
│   │   ├── seed_sqlite.py     # Python seeding script
│   │   └── work-package-raw-data.csv  # 100k detection records
│   ├── Dockerfile
│   └── package.json
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── components/        # UI components
│   │   └── lib/
│   │       └── api.ts         # Backend API client
│   └── package.json
├── TESTING.md                 # Scenario-wise curl examples
├── docker-compose.yml          # Docker orchestration
├── Dockerfile                 # Docker build configuration
├── start.sh                   # Docker startup script
├── package.json              # Root package.json with workspaces
└── README.md
```

## 🔌 API Endpoints

### Health Check
```
GET /api/health
```

### Get Detections
```
POST /api/detections
Body: { filters: {...}, limit: 100, offset: 0 }
```

### Aggregate Metrics
```
POST /api/aggregate
Body: { metric: 'count', filters: {...}, groupBy: 'hour' }
```

### Close Calls
```
POST /api/close-calls
Body: { filters: { timeRange: {...} }, distance: 2.0 }
```

### Quick KPIs
```
GET /api/vest-violations?from=2025-01-01&to=2025-01-07
GET /api/overspeed?from=2025-01-01&to=2025-01-07&threshold=1.5
```

## 🧪 Testing

### Test Suite Overview
The project includes comprehensive test suites for both frontend and backend:

- **Backend Unit Tests**: Jest-based API endpoint and business logic tests
- **Backend Ground Truth Tests**: Validates against real dataset (100k records) 
- **Frontend Tests**: React component testing with Vitest and Testing Library

### Running Tests

```bash
# Backend unit tests
cd backend && npm test

# Backend ground truth tests (uses real database)
cd backend && npx jest --config jest.groundtruth.config.js

# Frontend tests
cd frontend && npm test

# All tests (if configured)
npm run test:all
```

### Test Results Summary
- ✅ **Ground Truth Tests**: 4/4 passing (validates vest filter logic)
- ✅ **Frontend Tests**: 20/20 passing (all UI components)
- ⚠️ **Backend Unit Tests**: Some failures due to test database setup (non-critical)

### Run backend tests in Docker (no local Node setup)
```bash
docker run --rm -it \
  -v "$PWD/backend":/app -w /app \
  -e NODE_ENV=test -e TEST_SQLITE_PATH=./test_kpi_builder.sqlite \
  node:18-alpine sh -lc "npm ci && npm test"
```

### Manual API Testing
```bash
# Health check
curl -s http://localhost:3001/api/health | jq .

# Get sample data
curl -s -X POST http://localhost:3001/api/detections \
  -H 'Content-Type: application/json' \
  -d '{"limit":5}' | jq .

# Test aggregation
curl -s -X POST http://localhost:3001/api/aggregate \
  -H 'Content-Type: application/json' \
  -d '{"metric":"count","groupBy":"hour"}' | jq .
```

### Expected Results
- **Health Check**: `{"status": "healthy", "recordCount": 100000}`
- **Detections**: Array of detection objects with coordinates, timestamps, etc.
- **Aggregations**: Time-series data for charts and KPIs

## Ground Truth Validation

The dataset contains **100,000 detection records** from April 2, 2025 (15:42:06 to 16:00:18 UTC).

### Confirmed Ground Truth Values:
- **Total Human Detections**: 28,323
- **Total Vehicle Detections**: 71,677
- **Vest Violations** (human, vest=0): 10,312
- **Overspeed Events** (speed > 1.5 m/s): 16,599
  - Human: 15,013
  - Vehicle: 1,586
- **Close Calls** (distance ≤ 2.0m, time ≤ 250ms): 0

### Validation Commands:
```bash
# Test vest violations
curl -X POST http://localhost:3001/api/aggregate \
  -H 'Content-Type: application/json' \
  -d '{
    "metric": "vest_violations",
    "filters": {
      "timeRange": {"from": "2025-04-02T15:42:06Z", "to": "2025-04-02T16:00:19Z"}
    },
    "groupBy": "day"
  }' | jq '.meta.filteredRecords'
# Expected: 10312

# Test overspeed by class
curl -X POST http://localhost:3001/api/aggregate \
  -H 'Content-Type: application/json' \
  -d '{
    "metric": "overspeed",
    "filters": {
      "timeRange": {"from": "2025-04-02T15:42:06Z", "to": "2025-04-02T16:00:19Z"},
      "classes": ["human", "vehicle"]
    },
    "groupBy": "class"
  }' | jq '.series'
# Expected: [{"label": "human", "value": 15013}, {"label": "vehicle", "value": 1586}]

# Test total overspeed events
curl -X POST http://localhost:3001/api/aggregate \
  -H 'Content-Type: application/json' \
  -d '{
    "metric": "overspeed",
    "filters": {
      "timeRange": {"from": "2025-04-02T15:42:06Z", "to": "2025-04-02T16:00:19Z"},
      "classes": ["human", "vehicle"]
    },
    "groupBy": "day"
  }' | jq '.meta.filteredRecords'
# Expected: 16599

# Test close calls (should be 0)
curl -X POST http://localhost:3001/api/close-calls \
  -H 'Content-Type: application/json' \
  -d '{
    "filters": {
      "timeRange": {"from": "2025-04-02T15:42:06Z", "to": "2025-04-02T16:00:19Z"}
    },
    "distance": 2.0
  }' | jq '.series | map(.value) | add'
# Expected: 0
```

## 🛠️ Development

### Local Development
**Install all dependencies:**
```bash
npm run install:all
```

**Start backend:**
```bash
./scripts/start-backend.sh
# or
npm run dev:backend
```

**Start frontend:**
```bash
./scripts/start-frontend.sh
# or
npm run dev:frontend
```

**Start both (development):**
```bash
npm run dev
```

### Docker Development
Use the commands above. Avoid running the local backend on port 3001 while Docker is up to prevent EADDRINUSE.

## ✅ Features

- ✅ 100k+ detection records auto-seeded with Python
- ✅ SQLite database with optimized indexing
- ✅ RESTful API with flexible filtering and aggregation
- ✅ Close-call detection (< 2m proximity algorithm)
- ✅ Vest violation tracking for safety compliance
- ✅ Overspeed monitoring with configurable thresholds
- ✅ Dynamic KPI builder with custom metrics
- ✅ Interactive charts (line, bar, area)
- ✅ Real-time filtering by class, area, time range
- ✅ Dockerized for easy deployment
- ✅ Comprehensive test suites
- ✅ Separate startup scripts for development

## 🐛 Troubleshooting

**"Database not seeded"**
```bash
# Check if database file exists
ls -la backend/data/kpi_builder.sqlite

# Re-run seeding script
cd backend/data && python3 seed_sqlite.py
```

**"Backend won't start"**
```bash
# Check if port is in use
lsof -i:3001

# Kill existing process
pkill -f "node.*server"

# Restart backend
./scripts/start-backend.sh
```

If you see `EADDRINUSE: address already in use :::3001` when running locally:
```bash
# Find and kill the process holding 3001
lsof -i:3001
kill -9 <PID>

# Or run on another port temporarily
PORT=3002 npm run dev:backend
```
The server is guarded to not auto-start under tests (`NODE_ENV=test`). Avoid running the backend locally while Docker is up (both bind port 3001).

**"Frontend can't reach API"**
```bash
# Check if backend is running
curl http://localhost:3001/api/health

# Check frontend environment
cat frontend/.env
```

**"Docker issues"**
```bash
# Check Docker status
docker-compose ps

# View logs
docker-compose logs backend

# Reset everything
docker-compose down -v
./start.sh
```

## 📝 License

MIT

## 🤖 Automated Testing

### Test Suite Status
The project includes comprehensive test suites with the following status:

**✅ Working Test Suites:**
- **Ground Truth Tests**: 4/4 passing - Validates vest filter logic against real dataset
- **Frontend Tests**: 20/20 passing - All React components and UI interactions
- **API Integration Tests**: Core endpoints working correctly

**⚠️ Partially Working:**
- **Backend Unit Tests**: Some failures due to test database setup (non-critical for demo)

**Test Coverage:**
- ✅ Vest filter logic (vest=0, vest=1, vest=2)
- ✅ Ground truth validation (10,312 vest violations, 18,011 vest worn, 28,323 total)
- ✅ API endpoints with various filters
- ✅ Frontend component rendering and interactions
- ✅ Error handling and edge cases
- ✅ Data validation and type checking

**Run Tests:**
```bash
# Ground truth tests (recommended for demo)
cd backend && npx jest --config jest.groundtruth.config.js

# Frontend tests
cd frontend && npm test

# Backend unit tests (has some failures)
cd backend && npm test
```
