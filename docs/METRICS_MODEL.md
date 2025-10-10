# KPI Metrics Model

## Overview

The KPI Builder uses a standardized metrics model that separates core metrics from filter combinations. This design makes the system more intuitive and maintainable.

## Core Metrics

### 1. Count of Events
- **Backend metric**: `count`
- **Description**: Raw count of detections matching filters
- **Use cases**: 
  - Total detections in time range
  - Vest violations (with vest=0 filter)
  - Overspeed events (with speedMin filter)

### 2. Unique Asset IDs
- **Backend metric**: `unique_ids`
- **Description**: Count of distinct asset IDs in filtered data
- **Use cases**: 
  - Number of unique people/vehicles detected
  - Asset utilization analysis

### 3. Average Speed
- **Backend metric**: `avg_speed`
- **Description**: Mean speed of filtered detections
- **Use cases**: 
  - Average vehicle speed
  - Speed analysis by area/class

### 4. Events per Hour (Rate)
- **Frontend calculation**: Count divided by time duration
- **Description**: Rate of events over time
- **Use cases**: 
  - Activity rate analysis
  - Performance metrics

### 5. Close Calls (Special)
- **Backend endpoint**: `/api/close-calls`
- **Description**: Spatial analysis of human-vehicle proximity
- **Use cases**: 
  - Safety analysis
  - Risk assessment

## Grouping Options

### Time Bucket
- **Backend groupBy**: `hour`, `day`, `5min`, `1min`
- **X-axis**: Time labels (e.g., "8:40 PM", "Apr 2")
- **Use cases**: Time-series analysis

### Class
- **Backend groupBy**: `class`
- **X-axis**: Class labels (e.g., "Human", "Vehicle")
- **Use cases**: Comparison across object types

### Area/Zone
- **Backend groupBy**: `area`
- **X-axis**: Area labels (e.g., "Area 1", "Area 3")
- **Use cases**: Spatial analysis by physical zones

### Asset ID (Top 10)
- **Backend groupBy**: `class` (fetched), then client-side top 10
- **X-axis**: Asset labels (e.g., "Asset 123 (Top 10)")
- **Badge**: "Top 10 (client-side)"
- **Use cases**: Most active assets

### None (Total)
- **Backend groupBy**: `class` (fetched), then client-side sum
- **X-axis**: Single "Total" value
- **Use cases**: Overall summary

## Legacy Metric Mapping

For backward compatibility, legacy metric names are automatically mapped:

### Vest Violations
- **Legacy**: `vest_violations`
- **Maps to**: `count` + `vest=0` + `classes=['human']`
- **UI**: User selects "Count of Events" + "Vest Status: No Vest"

### Overspeed Events
- **Legacy**: `overspeed`
- **Maps to**: `count` + `speedMin=1.5` (or user-specified)
- **UI**: User selects "Count of Events" + "Speed Threshold"

## Examples

### Vest Violations Analysis
```json
{
  "metric": "count",
  "filters": {
    "vest": 0,
    "classes": ["human"],
    "timeRange": { "from": "...", "to": "..." }
  },
  "groupBy": "time_bucket",
  "timeBucket": "1hour"
}
```

### Vehicle Speed Analysis by Area
```json
{
  "metric": "avg_speed",
  "filters": {
    "classes": ["vehicle"],
    "timeRange": { "from": "...", "to": "..." }
  },
  "groupBy": "area"
}
```

### Top 10 Most Active Assets
```json
{
  "metric": "count",
  "filters": {
    "timeRange": { "from": "...", "to": "..." }
  },
  "groupBy": "asset_id"
}
```

## Benefits

1. **Clarity**: Users understand they're counting events with specific conditions
2. **Flexibility**: Any filter combination can be applied to any core metric
3. **Consistency**: All metrics follow the same pattern
4. **Maintainability**: Fewer special cases in the codebase
5. **Backward Compatibility**: Existing saved KPIs continue to work
