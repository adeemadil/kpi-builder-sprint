# Filter and Group By Logic

## UI to SQL Mapping

### 1. Filters → WHERE Clause

| UI Filter | SQL WHERE Clause |
|-----------|------------------|
| Classes: [human, vehicle] | `WHERE class IN ('human', 'vehicle')` |
| Time Range | `AND t >= '2025-04-02' AND t <= '2025-04-03'` |
| Vest: No Vest (0) | `AND vest = 0` |
| Speed > 1.5 | `AND speed > 1.5` |

**Logic**: All filters are combined with AND operator

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
