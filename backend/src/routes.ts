import { Router, Request, Response, NextFunction } from 'express';
import * as db from './db';

const router = Router();

// Log all requests going through this router
router.use((req: Request, _res: Response, next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.log(`[api] ${req.method} ${req.originalUrl}`);
  next();
});

function buildDetectionsWhere(filters: any | undefined) {
  const where: string[] = [];
  const params: any[] = [];

  if (!filters) return { whereSql: '', params };

  // timeRange: { from, to }
  if (filters.timeRange?.from) {
    params.push(new Date(filters.timeRange.from));
    where.push(`t >= $${params.length}`);
  }
  if (filters.timeRange?.to) {
    params.push(new Date(filters.timeRange.to));
    where.push(`t <= $${params.length}`);
  }

  // classes: string[]
  if (Array.isArray(filters.classes) && filters.classes.length > 0) {
    const placeholders = filters.classes.map((c: string) => {
      params.push(c);
      return `$${params.length}`;
    });
    where.push(`class IN (${placeholders.join(',')})`);
  }

  // vest: 0 | 1
  if (filters.vest === 0 || filters.vest === 1) {
    params.push(filters.vest);
    where.push(`vest = $${params.length}`);
  }

  // speed range
  if (typeof filters.speedMin === 'number') {
    params.push(filters.speedMin);
    where.push(`speed >= $${params.length}`);
  }
  if (typeof filters.speedMax === 'number') {
    params.push(filters.speedMax);
    where.push(`speed <= $${params.length}`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return { whereSql, params };
}

// GET /health
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const row = await db.queryOne('SELECT COUNT(*)::int as count FROM detections');
    res.json({
      status: 'healthy',
      recordCount: (row?.count as number) || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// POST /detections
router.post('/detections', async (req: Request, res: Response) => {
  try {
    const { filters, limit = 100, offset = 0 } = req.body || {};
    const { whereSql, params } = buildDetectionsWhere(filters);

    const dataSql = `
      SELECT id, class, t, x, y, heading, vest, speed
      FROM detections
      ${whereSql}
      ORDER BY t ASC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;
    const dataParams = [...params, Number(limit), Number(offset)];

    const countSql = `SELECT COUNT(*)::int AS count FROM detections ${whereSql}`;
    const [data, countRow] = await Promise.all([
      db.query(dataSql, dataParams),
      db.queryOne(countSql, params),
    ]);

    res.json({ data, count: (countRow?.count as number) || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch detections' });
  }
});

// POST /aggregate
router.post('/aggregate', async (req: Request, res: Response) => {
  try {
    const startMs = Date.now();
    const { metric, filters, groupBy } = req.body || {};

    // Validate inputs
    const allowedMetrics = ['count', 'unique_ids', 'avg_speed'] as const;
    const allowedGroups = ['hour', 'day', 'class'] as const;
    if (!allowedMetrics.includes(metric)) {
      return res.status(400).json({ error: 'Invalid metric' });
    }
    if (!allowedGroups.includes(groupBy)) {
      return res.status(400).json({ error: 'Invalid groupBy' });
    }

    const { whereSql, params } = buildDetectionsWhere(filters);

    let groupExpr = '';
    let selectTimeOrLabel = '';
    if (groupBy === 'hour') {
      groupExpr = `date_trunc('hour', t)`;
      selectTimeOrLabel = `${groupExpr} AS time`;
    } else if (groupBy === 'day') {
      groupExpr = `date_trunc('day', t)`;
      selectTimeOrLabel = `${groupExpr} AS time`;
    } else {
      groupExpr = `class`;
      selectTimeOrLabel = `class AS label`;
    }

    let valueExpr = '';
    if (metric === 'count') valueExpr = 'COUNT(*)::float AS value';
    if (metric === 'unique_ids') valueExpr = 'COUNT(DISTINCT id)::float AS value';
    if (metric === 'avg_speed') valueExpr = 'AVG(speed)::float AS value';

    const sql = `
      SELECT ${selectTimeOrLabel}, ${valueExpr}
      FROM detections
      ${whereSql}
      GROUP BY ${groupExpr}
      ORDER BY ${groupExpr} ASC
    `;

    const rows = await db.query(sql, params);

    const totalRow = await db.queryOne(`SELECT COUNT(*)::int AS count FROM detections`);
    const filteredRow = await db.queryOne(`SELECT COUNT(*)::int AS count FROM detections ${whereSql}`, params);
    const executionTime = Date.now() - startMs;

    res.json({
      series: rows,
      meta: {
        metric,
        groupBy,
        totalRecords: (totalRow?.count as number) || 0,
        filteredRecords: (filteredRow?.count as number) || 0,
        executionTime,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to aggregate' });
  }
});

// POST /close-calls
router.post('/close-calls', async (req: Request, res: Response) => {
  try {
    const { filters, distance } = req.body || {};
    const threshold = typeof distance === 'number' ? distance : 2.0;

    // Only timeRange is supported in filters here
    const timeParams: any[] = [];
    const humanWhereParts: string[] = [];
    const vehicleWhereParts: string[] = [];

    if (filters?.timeRange?.from) {
      timeParams.push(new Date(filters.timeRange.from));
      humanWhereParts.push(`h.t >= $${timeParams.length}`);
      vehicleWhereParts.push(`v.t >= $${timeParams.length}`);
    }
    if (filters?.timeRange?.to) {
      timeParams.push(new Date(filters.timeRange.to));
      humanWhereParts.push(`h.t <= $${timeParams.length}`);
      vehicleWhereParts.push(`v.t <= $${timeParams.length}`);
    }

    // Humans vs vehicles heuristic
    humanWhereParts.push(`(h.class ILIKE 'human' OR h.class ILIKE 'person' OR h.vest IS NOT NULL)`);
    vehicleWhereParts.push(`NOT (v.class ILIKE 'human' OR v.class ILIKE 'person' OR v.vest IS NOT NULL)`);

    const humansWhereSql = humanWhereParts.length ? `WHERE ${humanWhereParts.join(' AND ')}` : '';
    const vehiclesWhereSql = vehicleWhereParts.length ? `WHERE ${vehicleWhereParts.join(' AND ')}` : '';

    const sql = `
      WITH humans AS (
        SELECT id, class, t, x, y, vest FROM detections h
        ${humansWhereSql}
      ),
      vehicles AS (
        SELECT id, class, t, x, y, vest FROM detections v
        ${vehiclesWhereSql}
      )
      SELECT date_trunc('hour', h.t) AS time, COUNT(*)::int AS value
      FROM humans h
      JOIN vehicles v
        ON date_trunc('second', h.t) = date_trunc('second', v.t)
       AND sqrt(power(h.x - v.x, 2) + power(h.y - v.y, 2)) < $${timeParams.length + 1}
      GROUP BY date_trunc('hour', h.t)
      ORDER BY date_trunc('hour', h.t)
    `;

    const rows = await db.query(sql, [...timeParams, threshold]);
    res.json({ series: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compute close calls' });
  }
});

// GET /vest-violations?from=...&to=...
router.get('/vest-violations', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query as Record<string, string | undefined>;
    const where: string[] = ['vest = 0'];
    const params: any[] = [];
    if (from) {
      params.push(new Date(from));
      where.push(`t >= $${params.length}`);
    }
    if (to) {
      params.push(new Date(to));
      where.push(`t <= $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `
      SELECT date_trunc('day', t) AS time, COUNT(*)::int AS value
      FROM detections
      ${whereSql}
      GROUP BY date_trunc('day', t)
      ORDER BY date_trunc('day', t)
    `;
    const rows = await db.query(sql, params);
    res.json({ series: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vest violations' });
  }
});

// GET /overspeed?from=...&to=...&threshold=...
router.get('/overspeed', async (req: Request, res: Response) => {
  try {
    const { from, to, threshold } = req.query as Record<string, string | undefined>;
    const th = threshold ? Number(threshold) : 1.5;
    const where: string[] = ['speed > $1'];
    const params: any[] = [th];
    if (from) {
      params.push(new Date(from));
      where.push(`t >= $${params.length}`);
    }
    if (to) {
      params.push(new Date(to));
      where.push(`t <= $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `
      SELECT class AS label, COUNT(*)::int AS value
      FROM detections
      ${whereSql}
      GROUP BY class
      ORDER BY class
    `;
    const rows = await db.query(sql, params);
    res.json({ series: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch overspeed stats' });
  }
});

export default router;


