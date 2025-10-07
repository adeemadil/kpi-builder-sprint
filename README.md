# Safety Analytics - KPI Builder

Dynamic KPI analytics dashboard for industrial safety monitoring.

## 🚀 Quick Start (Docker)

**One command to run everything:**

```bash
docker-compose up --build
```

The system will:
1. Start PostgreSQL database
2. Start backend API server
3. Automatically seed database with 100k records (first run only)
4. Expose API at http://localhost:3001

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
│   │   ├── db.ts              # Database connection & seeding
│   │   └── routes.ts          # API endpoints
│   ├── data/
│   │   ├── schema.sql         # PostgreSQL schema
│   │   ├── seed_sqlite.py     # Seed script (repurposed for Postgres)
│   │   └── work-package-raw-data.csv  # 100k detection records
│   ├── Dockerfile
│   └── package.json
├── frontend/                  # Lovable frontend (React)
│   ├── src/
│   │   ├── components/        # UI components
│   │   └── lib/
│   │       └── api.ts         # Backend API client
│   └── package.json
├── docker-compose.yml          # Orchestration
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

## 🧪 Testing the API

### Quick Health Check
```bash
curl -s http://localhost:3001/api/health | jq .
```
Expected response:
```json
{
  "status": "healthy",
  "recordCount": 37000,
  "timestamp": "2025-10-07T..."
}
```

### Test Detections Endpoint
```bash
# Get 5 human detections
curl -s -X POST http://localhost:3001/api/detections \
  -H 'Content-Type: application/json' \
  -d '{"filters":{"classes":["human"]},"limit":5,"offset":0}' | jq .
```
Expected response:
```json
{
  "data": [
    {
      "id": "H001",
      "class": "human",
      "t": "2025-01-01T08:00:00Z",
      "x": 10.5,
      "y": 20.3,
      "speed": 1.2,
      "heading": 45,
      "vest": 1
    }
    // ... more items ...
  ],
  "count": 5
}
```

### Test Aggregate Endpoint
```bash
# Count detections by hour
curl -s -X POST http://localhost:3001/api/aggregate \
  -H 'Content-Type: application/json' \
  -d '{"metric":"count","filters":{},"groupBy":"hour"}' | jq .
```
Expected response:
```json
{
  "series": [
    {"time": "2025-01-01 08:00:00", "value": 145},
    {"time": "2025-01-01 09:00:00", "value": 178}
    // ...
  ],
  "meta": {
    "metric": "count",
    "groupBy": "hour",
    "totalRecords": 37000,
    "filteredRecords": 37000,
    "executionTime": 45
  }
}
```

### Test Close Calls
```bash
curl -s -X POST http://localhost:3001/api/close-calls \
  -H 'Content-Type: application/json' \
  -d '{"filters":{"timeRange":{"from":"2025-01-01","to":"2025-01-07"}},"distance":2.0}' | jq .
```

### Test Vest Violations
```bash
curl -s "http://localhost:3001/api/vest-violations?from=2025-01-01&to=2025-01-07" | jq .
```

### Test Overspeed Events
```bash
curl -s "http://localhost:3001/api/overspeed?from=2025-01-01&to=2025-01-07&threshold=1.5" | jq .
```

### All Tests at Once
```bash
# Run this script to test all endpoints
./test-api.sh
```

## 🛠️ Development

**Backend only:**
```bash
cd backend
npm install
npm run dev
```

**Frontend only:**
```bash
cd frontend
npm install
npm run dev
```

**View logs:**
```bash
docker-compose logs -f backend
docker-compose logs -f postgres
```

**Restart services:**
```bash
docker-compose restart backend
```

**Stop everything:**
```bash
docker-compose down
```

**Reset database:**
```bash
docker-compose down -v  # Removes volume
docker-compose up --build
```

## ✅ Features

- ✅ 100k+ detection records auto-seeded on first run
- ✅ PostgreSQL database with proper indexing
- ✅ RESTful API with flexible filtering
- ✅ Close-call detection (< 2m proximity)
- ✅ Vest violation tracking
- ✅ Overspeed monitoring
- ✅ Aggregation by hour/day/class
- ✅ Dockerized for easy deployment

## 🐛 Troubleshooting

**"Database connection failed"**
```bash
# Check if PostgreSQL is running
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres
```

**"Port already in use"**
```bash
# Stop all services
docker-compose down

# Check what's using the port
lsof -i:3001
lsof -i:5432
```

**"Frontend can't reach API"**
- Check VITE_API_URL in frontend/.env
- Verify backend is running: curl http://localhost:3001/api/health

## 📝 License

MIT

## 🤖 Automated Testing

Run the automated test suite:

```bash
cd backend
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

Tests cover:
- ✅ Database connection
- ✅ All API endpoints
- ✅ Filter combinations
- ✅ Aggregation logic
- ✅ Close-call detection
- ✅ Error handling
- ✅ Edge cases
