
# Example KPI SQL snippets (SQLite/Postgres-ish)

-- Vest violations
SELECT date(t) AS day, COUNT(*) AS vest_violations
FROM detections
WHERE class='human' AND IFNULL(vest,0)=0 AND t BETWEEN :from AND :to
GROUP BY 1 ORDER BY 1;

-- Overspeed (if speed column present)
SELECT class, COUNT(*) AS overspeed_events
FROM detections
WHERE speed > :threshold AND t BETWEEN :from AND :to
GROUP BY class ORDER BY overspeed_events DESC;

-- Close calls (approx; join on exact timestamps in SQLite)
WITH humans AS (
  SELECT t, x, y FROM detections WHERE class='human' AND t BETWEEN :from AND :to
),
veh AS (
  SELECT t, x, y FROM detections WHERE class IN ('vehicle','pallet_truck','agv') AND t BETWEEN :from AND :to
),
joined AS (
  SELECT h.t AS t, ((h.x - v.x)*(h.x - v.x) + (h.y - v.y)*(h.y - v.y)) AS d2
  FROM humans h JOIN veh v ON h.t = v.t
)
SELECT strftime('%Y-%m-%d %H:%M:00', t) AS minute, COUNT(*) AS close_calls
FROM joined
WHERE d2 < (:radius * :radius)
GROUP BY 1 ORDER BY 1;
