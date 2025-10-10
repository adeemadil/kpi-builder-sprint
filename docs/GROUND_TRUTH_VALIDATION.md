# Ground Truth Validation Guide

This document provides detailed validation methodology and troubleshooting for the KPI Builder's ground truth data validation.

## Dataset Overview

- **Total Records**: 100,000 detection records
- **Time Period**: April 2, 2025, 15:42:06 UTC to 16:00:18 UTC (18 minutes, 12 seconds)
- **Data Source**: `work-package-raw-data.csv`
- **Database**: SQLite (`kpi_builder.sqlite`)

## Confirmed Ground Truth Values

### 1. Total Detection Counts
- **Human Detections**: 28,323
- **Vehicle Detections**: 71,677
- **Total**: 100,000

### 2. Vest Violations
- **Definition**: Human detections where `vest = 0` (not wearing safety vest)
- **Count**: 10,312
- **Percentage**: 36.4% of human detections

### 3. Overspeed Events
- **Definition**: Detections where `speed > 1.5 m/s`
- **Total Count**: 16,599
- **Breakdown by Class**:
  - Human: 15,013 (90.4% of overspeed events)
  - Vehicle: 1,586 (9.6% of overspeed events)

### 4. Close Calls
- **Definition**: Human and vehicle detections within 2.0 meters and 250ms time tolerance
- **Count**: 0 (confirmed through Python/Colab analysis)

## Validation SQL Queries

### Vest Violations
```sql
SELECT COUNT(*) FROM detections 
WHERE class = 'human' 
  AND vest = 0 
  AND t >= '2025-04-02 15:42:06' 
  AND t <= '2025-04-02 16:00:19';
-- Expected: 10312
```

### Overspeed Events (Total)
```sql
SELECT COUNT(*) FROM detections 
WHERE speed > 1.5 
  AND t >= '2025-04-02 15:42:06' 
  AND t <= '2025-04-02 16:00:19';
-- Expected: 16599
```

### Overspeed Events by Class
```sql
SELECT class, COUNT(*) FROM detections 
WHERE speed > 1.5 
  AND class IN ('human', 'vehicle')
  AND t >= '2025-04-02 15:42:06' 
  AND t <= '2025-04-02 16:00:19'
GROUP BY class;
-- Expected: human=15013, vehicle=1586
```

### Close Calls Analysis
```sql
WITH humans AS (
  SELECT id, class, t, x, y FROM detections 
  WHERE LOWER(class) = 'human' 
    AND t >= '2025-04-02 15:42:06' 
    AND t <= '2025-04-02 16:00:19'
),
vehicles AS (
  SELECT id, class, t, x, y FROM detections 
  WHERE LOWER(class) != 'human' 
    AND t >= '2025-04-02 15:42:06' 
    AND t <= '2025-04-02 16:00:19'
)
SELECT COUNT(*) FROM humans h
JOIN vehicles v ON 
  strftime('%Y-%m-%d %H:%M:%S', h.t) = strftime('%Y-%m-%d %H:%M:%S', v.t)
  AND sqrt((h.x - v.x)*(h.x - v.x) + (h.y - v.y)*(h.y - v.y)) <= 2.0;
-- Expected: 0
```

## API Validation Tests

### Test Suite Location
- **Comprehensive Tests**: `backend/src/tests/groundTruth.test.ts`
- **Integration Tests**: `backend/src/tests/api.test.ts` (Ground Truth Validation section)

### Running Validation Tests
```bash
# Run all ground truth tests
cd backend && npm test -- --testNamePattern="Ground Truth"

# Run specific test file
cd backend && npm test groundTruth.test.ts

# Run with coverage
cd backend && npm run test:coverage
```

## Troubleshooting Common Issues

### 1. Vest Filter Not Working
**Symptoms**: Vest violations count doesn't match expected 10,312
**Causes**:
- Vest filter condition incorrectly checking for falsy values
- Frontend sending vest as string instead of number
- Database vest column contains null values

**Debug Steps**:
1. Check API logs for SQL query generation
2. Verify frontend sends `vest: 0` (number) not `vest: "0"` (string)
3. Run direct SQL query to verify data

### 2. Speed Filter Issues
**Symptoms**: Overspeed count doesn't match expected 16,599
**Causes**:
- Using `>=` instead of `>` for speed threshold
- Speed column contains null values
- Incorrect time range filtering

**Debug Steps**:
1. Verify speed filter uses `speed > 1.5` not `speed >= 1.5`
2. Check for null speed values: `SELECT COUNT(*) FROM detections WHERE speed IS NULL`
3. Validate time range parameters

### 3. Close Calls Always Zero
**Symptoms**: Close calls always return 0 regardless of distance threshold
**Causes**:
- Time matching too strict (exact second match)
- Distance calculation error
- Missing data in coordinate columns

**Debug Steps**:
1. Test with larger distance threshold (e.g., 5.0m)
2. Check coordinate data: `SELECT COUNT(*) FROM detections WHERE x IS NULL OR y IS NULL`
3. Verify time tolerance logic in close calls algorithm

### 4. Time Range Issues
**Symptoms**: Filtered counts don't match expected values
**Causes**:
- Timezone conversion errors
- Incorrect ISO format handling
- Database time format mismatch

**Debug Steps**:
1. Check time format in database: `SELECT MIN(t), MAX(t) FROM detections`
2. Verify timezone conversion in API
3. Test with broader time ranges

## Python/Colab Analysis Methodology

The ground truth values were confirmed using Python pandas analysis in Google Colab:

```python
import pandas as pd
import numpy as np

# Load data
df = pd.read_csv('work-package-raw-data.csv')

# Convert timestamp
df['t'] = pd.to_datetime(df['t'], utc=True)

# Time range filter
time_mask = (df['t'] >= '2025-04-02T15:42:06Z') & (df['t'] <= '2025-04-02T16:00:19Z')
df_filtered = df[time_mask]

# Vest violations
vest_violations = df_filtered[(df_filtered['class'] == 'human') & (df_filtered['vest'] == 0)]
print(f"Vest violations: {len(vest_violations)}")  # Expected: 10312

# Overspeed events
overspeed = df_filtered[df_filtered['speed'] > 1.5]
print(f"Overspeed events: {len(overspeed)}")  # Expected: 16599

# Close calls analysis
humans = df_filtered[df_filtered['class'] == 'human']
vehicles = df_filtered[df_filtered['class'] != 'human']

close_calls = 0
for _, human in humans.iterrows():
    for _, vehicle in vehicles.iterrows():
        if (human['t'] - vehicle['t']).total_seconds() <= 0.25:  # 250ms tolerance
            distance = np.sqrt((human['x'] - vehicle['x'])**2 + (human['y'] - vehicle['y'])**2)
            if distance <= 2.0:
                close_calls += 1

print(f"Close calls: {close_calls}")  # Expected: 0
```

## Performance Considerations

- **Index Usage**: Ensure indexes exist on `t`, `class`, `vest`, `speed`, `area`
- **Query Optimization**: Use EXPLAIN QUERY PLAN to verify index usage
- **Batch Processing**: For large datasets, consider pagination in API responses

## Continuous Validation

To ensure data integrity over time:

1. **Automated Tests**: Run ground truth tests in CI/CD pipeline
2. **Data Monitoring**: Set up alerts for significant count deviations
3. **Regular Audits**: Periodically re-run Python analysis on updated datasets
4. **Documentation Updates**: Update ground truth values when dataset changes

## Related Documentation

- [Filter and GroupBy Logic](FILTER_GROUPBY_LOGIC.md)
- [API Documentation](../README.md#api-endpoints)
- [Test Suite Documentation](../README.md#automated-testing)
