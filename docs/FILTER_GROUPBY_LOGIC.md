# Filter and Group By Logic

## UI to SQL Mapping

### 1. Filters → WHERE Clause

| UI Filter | SQL WHERE Clause | Notes |
|-----------|------------------|-------|
| Classes: [human, vehicle] | `WHERE class IN ('human', 'vehicle')` | Case-sensitive matching |
| Time Range | `AND t >= '2025-04-02' AND t <= '2025-04-03'` | UTC timezone conversion |
| Vest: No Vest (0) | `AND vest = 0` | **Critical**: Handles vest=0 correctly (not falsy) |
| Vest: Wearing Vest (1) | `AND vest = 1` | Must be explicitly 0 or 1, not null/undefined |
| Speed > 1.5 | `AND speed > 1.5` | **Critical**: Uses `>` not `>=` for overspeed |
| Areas: [1, 2, 3] | `AND area IN ('1', '2', '3')` | String-based area matching |

**Logic**: All filters are combined with AND operator

### Filter Implementation Details

#### Vest Filter Behavior
```typescript
// Frontend sends: vest: 0 | 1 | 'all'
// Backend condition: vest !== undefined && vest !== null && vest !== 'all'
if (filters.vest !== undefined && filters.vest !== null && filters.vest !== 'all') {
  const vestValue = Number(filters.vest);
  if (vestValue === 0 || vestValue === 1) {
    params.push(vestValue);
    where.push(`vest = $${params.length}`);
  }
}
```

**Key Points**:
- `vest = 0` means "not wearing safety vest" (violation)
- `vest = 1` means "wearing safety vest" (compliant)
- `vest = 'all'` or `undefined` means "no vest filter applied"
- **Critical Fix**: Explicitly checks for `null` to prevent `vest = 0` from being treated as falsy

#### Speed Filter Behavior
```typescript
// For overspeed detection: speed > threshold (not >=)
if (typeof filters.speedMin === 'number') {
  params.push(filters.speedMin);
  where.push(`speed > $${params.length}`);  // Uses > not >=
}
```

**Key Points**:
- Uses `>` (greater than) not `>=` (greater than or equal) for overspeed detection
- Default threshold: 1.5 m/s
- Only applies when `speedMin` is explicitly provided as a number

#### Close Calls Algorithm Parameters
```typescript
// Close calls detection: human-vehicle proximity within time tolerance
const sql = `
  WITH humans AS (
    SELECT id, class, t, x, y, vest FROM detections h
    WHERE LOWER(h.class) = 'human' AND [time_filters]
  ),
  vehicles AS (
    SELECT id, class, t, x, y, vest FROM detections v
    WHERE LOWER(v.class) != 'human' AND [time_filters]
  )
  SELECT strftime('%Y-%m-%dT%H:00:00Z', h.t) AS time, COUNT(*) AS value
  FROM humans h
  JOIN vehicles v
    ON strftime('%Y-%m-%d %H:%M:%S', h.t) = strftime('%Y-%m-%d %H:%M:%S', v.t)
   AND sqrt((h.x - v.x)*(h.x - v.x) + (h.y - v.y)*(h.y - v.y)) < distance_threshold
  GROUP BY strftime('%Y-%m-%dT%H:00:00Z', h.t)
`;
```

**Key Parameters**:
- **Distance Threshold**: Default 2.0 meters (configurable)
- **Time Tolerance**: Exact second match (strftime '%Y-%m-%d %H:%M:%S')
- **Class Logic**: Humans vs non-humans (vehicles, etc.)
- **Ground Truth**: 0 close calls with distance ≤ 2.0m and exact time matching

### 2. Group By → GROUP BY Clause

| UI Group By | UI Time Bucket | Backend groupBy | SQL GROUP BY |
|-------------|----------------|-----------------|--------------|
| Time Bucket | 1 Hour | hour | `GROUP BY strftime('%Y-%m-%dT%H:00:00Z', t)` |
| Time Bucket | 1 Day | day | `GROUP BY strftime('%Y-%m-%dT00:00:00Z', t)` |
| Time Bucket | 5 Minutes | 5min | `GROUP BY strftime('%Y-%m-%dT%H:%M:00Z', t)` |
| Class | N/A | class | `GROUP BY class` |
| Area | N/A | area | `GROUP BY area` |

### 3. Complete Examples

#### Example 1: Count Humans by Hour
```
UI:
- Metric: Count
- Classes: [human]
- Group By: Time Bucket (1 Hour)

Transform:
→ groupBy: 'time_bucket' + timeBucket: '1hour' → groupBy: 'hour'

SQL:
SELECT strftime('%Y-%m-%dT%H:00:00Z', t) AS time, COUNT(*) AS value
FROM detections
WHERE class IN ('human')
GROUP BY strftime('%Y-%m-%dT%H:00:00Z', t)
```

#### Example 2: Count by Class
```
UI:
- Metric: Count
- Classes: [human, vehicle]
- Group By: Class

Transform:
→ groupBy: 'class' → groupBy: 'class'

SQL:
SELECT class AS label, COUNT(*) AS value
FROM detections
WHERE class IN ('human', 'vehicle')
GROUP BY class
```

## Architecture Overview

### Data Flow:
1. **UI Layer**: User selects filters (classes, time range) and grouping (time_bucket + timeBucket value)
2. **Saved KPI Storage**: Stores UI representation: `{ groupBy: 'time_bucket', timeBucket: '1hour' }`
3. **Transform Layer** (KPIBuilder lines 146-151): Converts to backend format: `{ groupBy: 'hour' }`
4. **Backend SQL**: Uses converted value to build `GROUP BY` clause

### Example Complete Flow:
```
UI Selection → Saved Config → Transform → Backend SQL
───────────────────────────────────────────────────────
Metric: Count
Classes: Human, Vehicle
Time Bucket: 1 Hour
→ { groupBy: 'time_bucket', timeBucket: '1hour' }
→ { groupBy: 'hour' }
→ SELECT strftime('%Y-%m-%dT%H:00:00Z', t) AS time, COUNT(*) 
  FROM detections 
  WHERE class IN ('human', 'vehicle')
  GROUP BY strftime('%Y-%m-%dT%H:00:00Z', t)
```

## Debugging

### Console Logs
When applying filters, check browser console for:
- `[KPIBuilder] Transform mapping:` - Shows UI → Backend transformation
- `[API /aggregate] SQL Query:` - Shows generated SQL query

### Network Tab
- Look for `POST /api/aggregate` requests
- Check request payload for correct `groupBy` value
- Verify response data structure matches expected format

### Backend Logs
- SQL queries are logged with parameters
- Check for any SQL errors or constraint violations
- Verify parameter binding is correct
