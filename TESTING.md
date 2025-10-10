# API Testing Scenarios

Base URL: http://localhost:3001/api

## 🧪 Test Suite Overview

The project includes comprehensive test suites for both frontend and backend:

### Backend Tests
- **Unit Tests**: Jest-based tests for API endpoints and business logic
- **Ground Truth Tests**: Validates against real dataset (100k records)
- **Integration Tests**: End-to-end API testing

### Frontend Tests  
- **Component Tests**: React component testing with Vitest
- **Unit Tests**: Library function testing
- **Integration Tests**: UI interaction testing

### Running Tests

```bash
# Backend tests
cd backend && npm test

# Backend ground truth tests (uses real database)
cd backend && npx jest --config jest.groundtruth.config.js

# Frontend tests
cd frontend && npm test

# All tests
npm run test:all
```

## Health
```bash
curl -s http://localhost:3001/api/health | jq .
```

## Detections (sample)
```bash
curl -s -X POST http://localhost:3001/api/detections \
  -H 'Content-Type: application/json' \
  -d '{"limit":5}' | jq .
```

## Aggregations (Ground Truth Window)
From: 2025-04-02T15:42:06Z
To:   2025-04-02T16:00:19Z

### Vest violations
```bash
curl -s -X POST http://localhost:3001/api/aggregate \
  -H 'Content-Type: application/json' \
  -d '{
    "metric":"vest_violations",
    "filters": {"timeRange":{"from":"2025-04-02T15:42:06Z", "to":"2025-04-02T16:00:19Z"}},
    "groupBy":"day"
  }' | jq '.meta.filteredRecords'
```

### Overspeed by class
```bash
curl -s -X POST http://localhost:3001/api/aggregate \
  -H 'Content-Type: application/json' \
  -d '{
    "metric":"overspeed",
    "filters": {"timeRange":{"from":"2025-04-02T15:42:06Z", "to":"2025-04-02T16:00:19Z"}, "classes":["human","vehicle"]},
    "groupBy":"class"
  }' | jq '.series'
```

### Overspeed total
```bash
curl -s -X POST http://localhost:3001/api/aggregate \
  -H 'Content-Type: application/json' \
  -d '{
    "metric":"overspeed",
    "filters": {"timeRange":{"from":"2025-04-02T15:42:06Z", "to":"2025-04-02T16:00:19Z"}, "classes":["human","vehicle"]},
    "groupBy":"day"
  }' | jq '.meta.filteredRecords'
```

### Area filter example
```bash
curl -s -X POST http://localhost:3001/api/aggregate \
  -H 'Content-Type: application/json' \
  -d '{
    "metric":"count",
    "filters": {"classes":["human"], "areas":["1"]},
    "groupBy":"day"
  }' | jq .
```

## Close calls
```bash
curl -s -X POST http://localhost:3001/api/close-calls \
  -H 'Content-Type: application/json' \
  -d '{
    "filters": {"timeRange":{"from":"2025-04-02T15:42:06Z", "to":"2025-04-02T16:00:19Z"}},
    "distance": 2.0
  }' | jq '.series | map(.value) | add'
```

## Negative tests
```bash
# Invalid metric
curl -s -X POST http://localhost:3001/api/aggregate \
  -H 'Content-Type: application/json' \
  -d '{"metric":"nope","groupBy":"day"}' | jq .

# Invalid groupBy
curl -s -X POST http://localhost:3001/api/aggregate \
  -H 'Content-Type: application/json' \
  -d '{"metric":"count","groupBy":"week"}' | jq .
```
