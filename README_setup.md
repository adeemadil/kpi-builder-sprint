
# Dynamic Chart Builder — Take‑Home Assignment

## Problem
You are given a raw CSV of position and event detections from an industrial environment (humans, vehicles, pallet trucks, AGVs, etc.).
Your task is to build a **dynamic chart/analytics builder** that lets an end user define flexible KPIs and visualize them interactively.

Examples of KPIs:
- Number of **human–vehicle close calls** in a time range.
- Count of **overspeeding events** by area, by hour, or by asset.
- Number of **vest violations** (vest=0) by class, by zone.
- Dwell time of a class inside a zone.
- Top N risky areas by near‑miss density.

The UI should allow a non‑technical user to:
1. Pick a **metric** (e.g., count of events, unique IDs, rate per hour).
2. Apply **filters** (time range, class, zones, speed thresholds, vest worn/not worn, heading ranges).
3. Choose **grouping** (by time bucket, by class, by zone, by asset ID).
4. Choose a **chart** (bar/line/area/heatmap/table).
5. Save/share **KPI presets**.

> You can use any stack you like. You may load the CSV into a database of your choice and build APIs + UI on top.

---

## Input data
This CSV (sample provided) contains rows of tracked objects with local coordinates and attributes.

**Expected classes**: `human`, `vehicle`, `pallet_truck`, `agv`  
**Columns discovered from the sample file** (infer from dtypes shown in the companion table in this notebook; candidate code must not hard‑code column order).

- `id` — unique tracking ID per object trajectory.
- `class` — object class label.
- `x`, `y` — local coordinates in meters from a fixed origin.
- `t` or `timestamp` — event time (ms or ISO). (Use the actual column in the CSV.)
- `speed` — instantaneous speed (if present; else derive from positions over time).
- `heading` — heading angle in degrees (0–360).
- `vest` — 1 if wearing reflective vest, 0 otherwise.
- Additional columns may exist; ignore or leverage as you see fit.

> **Note**: Some derived metrics (e.g., speed) may require you to compute deltas by `id` ordered by time. If speed isn’t present, implement a simple finite‑difference speed (meters/second) and a configurable overspeed threshold (e.g., default 1.5 m/s).

---

## Functional requirements
- **Data layer**
  - Load the CSV into a relational DB (SQLite/Postgres/MySQL all fine). Provide a repeatable setup script.
  - Expose a small, clean **REST (or GraphQL) API** to query aggregated metrics with parameters:
    - `metric` (count, unique_ids, avg_speed, rate)
    - `filters` (time range, classes, vest, speed thresholds, heading range, polygon/rect zones)
    - `group_by` (time_bucket, class, zone, id)
    - `time_bucket` (e.g., 1m/5m/1h)
- **KPI builder UI**
  - Form to define metric + filters + grouping + chart type.
  - Live preview chart and a data table.
  - Ability to **save a KPI** (persist JSON spec in local storage or DB).
- **Charts**
  - At least two: line/area for time series and bar for categorical groupings. Heatmap or scatter is a bonus.
- **Close‑call detection**
  - Parameterized rule: distance between a `human` and a `vehicle|pallet_truck|agv` under **D meters** (default 2.0) within the same time bucket → count as a close call. Use Euclidean distance on synchronized timestamps (tolerance/window configurable, e.g., ±250 ms).
- **Overspeed events**
  - Count records where `speed > threshold` (default 1.5 m/s). If speed is derived, compute per `id`.
- **Vest violations**
  - Count records where `class='human' AND vest=0`.
- **Zones (optional, nice‑to‑have)**
  - Define polygonal or rectangular zones; allow filtering/grouping by zone.

---

## Non‑functional
- Clear README with setup, run steps, and assumptions.
- Code should be reasonably organized and tested (a few unit tests on aggregation helpers are enough).
- Include sample **curl** (or Postman collection) calls for the API.

---

## Scoring rubric (100 pts)
- Data ingestion & correctness (20) — repeatable seed; sane types; basic indices.
- API design & flexibility (25) — supports metrics, filters, grouping, time bucketing.
- KPI builder UX (25) — intuitive, responsive, sensible defaults, useful presets.
- Close‑call logic (15) — parameterized, efficient.
- Overspeed & vest KPIs (10) — correct and filterable.
- Code quality & docs (5).
- Tests (optional bonus +5).

---

## Example API contract (suggestion)
`GET /api/aggregate?metric=count&entity=events&class=human,vehicle&vest=0&group_by=time_bucket:5m,class&from=2025-01-01T00:00:00Z&to=2025-01-01T06:00:00Z`

Response:
```json
{
  "series": [
    { "time": "2025-01-01T00:00:00Z", "class": "human", "value": 12 },
    { "time": "2025-01-01T00:00:00Z", "class": "vehicle", "value": 3 }
  ],
  "meta": { "metric": "count", "bucket": "5m" }
}
```

---

## Suggested schema (adjust to your DB)
```sql
CREATE TABLE detections (
  id TEXT NOT NULL,
  class TEXT NOT NULL,
  t TIMESTAMP NOT NULL,         -- or BIGINT ms epoch; normalize during import
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  vest INTEGER,                 -- 0/1 for humans; NULL otherwise
  speed DOUBLE PRECISION,       -- optional; compute if absent
  PRIMARY KEY (id, t)
);
CREATE INDEX IF NOT EXISTS idx_detections_t ON detections(t);
CREATE INDEX IF NOT EXISTS idx_detections_class ON detections(class);
```

---

## Example KPI queries (Postgres flavor)
**Vest violations per hour**
```sql
SELECT date_trunc('hour', t) AS hour, COUNT(*) AS violations
FROM detections
WHERE class = 'human' AND vest = 0 AND t BETWEEN $1 AND $2
GROUP BY 1 ORDER BY 1;
```

**Overspeeding events by class**
```sql
SELECT class, COUNT(*) AS overspeed_events
FROM detections
WHERE speed > $1 AND t BETWEEN $2 AND $3
GROUP BY class ORDER BY overspeed_events DESC;
```

**Close calls (naive join)**
```sql
WITH humans AS (
  SELECT id, t, x, y FROM detections WHERE class='human' AND t BETWEEN $1 AND $2
),
vehicles AS (
  SELECT id, t, x, y FROM detections WHERE class IN ('vehicle','pallet_truck','agv') AND t BETWEEN $1 AND $2
),
aligned AS (
  -- if timestamps are discrete; for tolerance join use BETWEEN with ±window
  SELECT h.t, h.id AS human_id, v.id AS other_id,
         sqrt((h.x - v.x)^2 + (h.y - v.y)^2) AS dist
  FROM humans h
  JOIN vehicles v ON v.t = h.t
)
SELECT date_trunc('minute', t) AS minute, COUNT(*) AS close_calls
FROM aligned
WHERE dist < $3
GROUP BY 1 ORDER BY 1;
```

---

## Submission
- Public repo link (or zip) with instructions.
- Short Loom/GIF (≤5 min) demo of the KPI builder.
- Include `.env.example` and a one‑command run (`docker-compose up` or similar) if possible.

---

## Assumptions & tips
- If the CSV timestamp is numeric, convert to UTC ISO at import.
- For speed derivation: for each `id`, order by `t`, compute distance to previous point divided by delta‑time.
- Cap insane deltas to avoid spikes (e.g., ignore if dt ≤ 0 or dt > 10 s).
- Document any heuristics (e.g., default overspeed threshold, close‑call radius).