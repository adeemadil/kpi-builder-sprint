# Safety Analytics - KPI Builder

Dynamic KPI analytics dashboard for industrial safety monitoring with real-time safety metrics, close-call detection, and customizable analytics.

## 🚀 Quick Start

### Option 1: Docker (Recommended)
**One command to run everything:**

```bash
./start.sh
```

This will:
1. Build and start the backend with Docker
2. Automatically seed database with 100k records (first run only)
3. Expose API at http://localhost:3001
4. Start frontend with: `./scripts/start-frontend.sh`

### Option 2: Local Development
**Backend:**
```bash
./scripts/start-backend.sh
```

**Frontend:**
```bash
./scripts/start-frontend.sh
```

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
├── scripts/                   # Startup scripts
│   ├── start-backend.sh       # Backend startup script
│   └── start-frontend.sh      # Frontend startup script
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

### Jest Unit Tests
```bash
# Run all tests
cd backend && npm test

# Run tests with coverage
cd backend && npm run test:coverage

# Run tests in watch mode
cd backend && npm run test:watch

# Run tests for CI
cd backend && npm run test:ci
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
**Start with Docker:**
```bash
./start.sh
# or
npm run docker:up
```

**View logs:**
```bash
npm run docker:logs
```

**Restart services:**
```bash
docker-compose restart backend
```

**Stop everything:**
```bash
npm run docker:down
```

**Reset database:**
```bash
docker-compose down -v  # Removes volume
npm run docker:up  # Rebuilds and reseeds
```

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

### Jest Test Suite
The project includes comprehensive Jest tests covering:

**API Endpoints:**
- ✅ Health check endpoint
- ✅ Detections endpoint with filtering
- ✅ Aggregate endpoint with multiple metrics
- ✅ Close-calls detection algorithm
- ✅ Vest violations tracking
- ✅ Overspeed event detection

**Test Coverage:**
- ✅ Database connection and seeding
- ✅ All API endpoints with various filters
- ✅ Aggregation logic (count, unique_ids, avg_speed)
- ✅ Error handling and edge cases
- ✅ Performance and response validation
- ✅ Data validation and type checking

**Run Tests:**
```bash
cd backend && npm test
cd backend && npm run test:coverage
```
