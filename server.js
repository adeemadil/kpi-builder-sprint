// server.js - Minimal Express API for KPI Builder
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./detections.sqlite');

// Health check
app.get('/api/health', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM detections', (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ status: 'healthy', recordCount: row.count });
  });
});

// Get detections with filters
app.post('/api/detections', (req, res) => {
  const { filters = {}, limit = 100 } = req.body;
  let query = 'SELECT * FROM detections WHERE 1=1';
  const params = [];

  if (filters.timeRange) {
    query += ' AND t BETWEEN ? AND ?';
    params.push(filters.timeRange.from, filters.timeRange.to);
  }
  if (filters.classes && filters.classes.length > 0) {
    query += ` AND class IN (${filters.classes.map(() => '?').join(',')})`;
    params.push(...filters.classes);
  }
  if (filters.vest !== undefined) {
    query += ' AND vest = ?';
    params.push(filters.vest);
  }
  if (filters.speedMin) {
    query += ' AND speed >= ?';
    params.push(filters.speedMin);
  }

  query += ` LIMIT ${limit}`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows, count: rows.length });
  });
});

// Aggregate endpoint
app.post('/api/aggregate', (req, res) => {
  const { metric, filters = {}, groupBy } = req.body;
  
  let selectClause, groupClause;
  
  // Build SELECT based on metric
  if (metric === 'count') {
    selectClause = 'COUNT(*) as value';
  } else if (metric === 'unique_ids') {
    selectClause = 'COUNT(DISTINCT id) as value';
  } else if (metric === 'avg_speed') {
    selectClause = 'AVG(speed) as value';
  }

  // Build GROUP BY
  if (groupBy === 'hour') {
    groupClause = "strftime('%Y-%m-%d %H:00:00', t) as time";
  } else if (groupBy === 'day') {
    groupClause = "date(t) as time";
  } else if (groupBy === 'class') {
    groupClause = 'class as label';
    selectClause += ', class as label';
  }

  let query = `SELECT ${selectClause}${groupClause ? ', ' + groupClause : ''} FROM detections WHERE 1=1`;
  const params = [];

  // Apply filters
  if (filters.timeRange) {
    query += ' AND t BETWEEN ? AND ?';
    params.push(filters.timeRange.from, filters.timeRange.to);
  }
  if (filters.classes) {
    query += ` AND class IN (${filters.classes.map(() => '?').join(',')})`;
    params.push(...filters.classes);
  }
  if (filters.vest !== undefined) {
    query += ' AND vest = ?';
    params.push(filters.vest);
  }

  if (groupBy) {
    query += ` GROUP BY ${groupBy === 'hour' ? 'time' : groupBy === 'day' ? 'time' : 'class'}`;
    query += ' ORDER BY time';
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ series: rows, meta: { metric, groupBy } });
  });
});

// Close calls detection
app.post('/api/close-calls', (req, res) => {
  const { filters = {}, distance = 2.0 } = req.body;
  const distSq = distance * distance;

  const query = `
    WITH humans AS (
      SELECT t, x, y FROM detections 
      WHERE class='human' 
      AND t BETWEEN ? AND ?
    ),
    vehicles AS (
      SELECT t, x, y FROM detections 
      WHERE class IN ('vehicle','pallet_truck','agv')
      AND t BETWEEN ? AND ?
    )
    SELECT 
      strftime('%Y-%m-%d %H:%M:00', h.t) as time,
      COUNT(*) as value
    FROM humans h
    JOIN vehicles v ON h.t = v.t
    WHERE ((h.x - v.x)*(h.x - v.x) + (h.y - v.y)*(h.y - v.y)) < ?
    GROUP BY time
    ORDER BY time
  `;

  const from = filters.timeRange?.from || '2025-01-01';
  const to = filters.timeRange?.to || '2025-01-31';

  db.all(query, [from, to, from, to, distSq], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ series: rows, meta: { metric: 'close_calls', distance } });
  });
});

// Vest violations
app.get('/api/vest-violations', (req, res) => {
  const { from, to } = req.query;
  const query = `
    SELECT date(t) as time, COUNT(*) as value
    FROM detections
    WHERE class='human' AND IFNULL(vest,0)=0 
    AND t BETWEEN ? AND ?
    GROUP BY date(t)
    ORDER BY time
  `;

  db.all(query, [from, to], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ series: rows, meta: { metric: 'vest_violations' } });
  });
});

// Overspeed events
app.get('/api/overspeed', (req, res) => {
  const { from, to, threshold = 1.5 } = req.query;
  const query = `
    SELECT class as label, COUNT(*) as value
    FROM detections
    WHERE speed > ? AND t BETWEEN ? AND ?
    GROUP BY class
    ORDER BY value DESC
  `;

  db.all(query, [threshold, from, to], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ series: rows, meta: { metric: 'overspeed', threshold } });
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 API running on http://localhost:${PORT}`);
  console.log('Test: curl http://localhost:3001/api/health');
});