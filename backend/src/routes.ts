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
    params.push(new Date(filters.timeRange.from).toISOString().replace('T', ' ').replace('Z', ''));
    where.push(`t >= $${params.length}`);
  }
  if (filters.timeRange?.to) {
    params.push(new Date(filters.timeRange.to).toISOString().replace('T', ' ').replace('Z', ''));
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

  // areas: string[]
  if (Array.isArray(filters.areas) && filters.areas.length > 0) {
    const placeholders = filters.areas.map((a: string) => {
      params.push(a);
      return `$${params.length}`;
    });
    where.push(`area IN (${placeholders.join(',')})`);
  }

  // vest: 0 | 1 (handle both string and number)
  if (filters.vest !== undefined && filters.vest !== 'all') {
    const vestValue = Number(filters.vest);
    if (vestValue === 0 || vestValue === 1) {
      params.push(vestValue);
      where.push(`vest = $${params.length}`);
    }
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
    const row = await db.queryOne('SELECT COUNT(*) as count FROM detections');
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

    const countSql = `SELECT COUNT(*) AS count FROM detections ${whereSql}`;
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
    const allowedMetrics = ['count', 'unique_ids', 'avg_speed', 'vest_violations', 'overspeed'] as const;
    const allowedGroups = ['hour', 'day', 'class', '5min', '1min'] as const;
    if (!allowedMetrics.includes(metric)) {
      return res.status(400).json({ error: 'Invalid metric' });
    }
    if (!allowedGroups.includes(groupBy)) {
      return res.status(400).json({ error: 'Invalid groupBy' });
    }

    // For specific metrics, add required filters
    let enhancedFilters = { ...filters };
    if (metric === 'vest_violations') {
      // Vest violations require vest=0 and class='human'
      enhancedFilters.vest = 0;
      if (!enhancedFilters.classes || !enhancedFilters.classes.includes('human')) {
        enhancedFilters.classes = ['human'];
      }
    }
    if (metric === 'overspeed') {
      // Overspeed requires speedMin filter (default to 1.5 if not provided)
      if (typeof enhancedFilters.speedMin !== 'number') {
        enhancedFilters.speedMin = 1.5;
      }
    }
    
    const { whereSql, params } = buildDetectionsWhere(enhancedFilters);

    let groupExpr = '';
    let selectTimeOrLabel = '';
    if (groupBy === 'hour') {
      groupExpr = `strftime('%Y-%m-%dT%H:00:00Z', t)`;
      selectTimeOrLabel = `${groupExpr} AS time`;
    } else if (groupBy === 'day') {
      groupExpr = `strftime('%Y-%m-%dT00:00:00Z', t)`;
      selectTimeOrLabel = `${groupExpr} AS time`;
    } else if (groupBy === '5min') {
      groupExpr = `strftime('%Y-%m-%dT%H:%M:00Z', t)`;
      selectTimeOrLabel = `${groupExpr} AS time`;
    } else if (groupBy === '1min') {
      groupExpr = `strftime('%Y-%m-%dT%H:%M:00Z', t)`;
      selectTimeOrLabel = `${groupExpr} AS time`;
    } else {
      groupExpr = `class`;
      selectTimeOrLabel = `class AS label`;
    }

    let valueExpr = '';
    if (metric === 'count') valueExpr = 'CAST(COUNT(*) AS REAL) AS value';
    if (metric === 'unique_ids') valueExpr = 'CAST(COUNT(DISTINCT id) AS REAL) AS value';
    if (metric === 'avg_speed') valueExpr = 'AVG(speed) AS value';
    if (metric === 'vest_violations') valueExpr = 'CAST(COUNT(*) AS REAL) AS value';
    if (metric === 'overspeed') valueExpr = 'CAST(COUNT(*) AS REAL) AS value';

    const sql = `
      SELECT ${selectTimeOrLabel}, ${valueExpr}
      FROM detections
      ${whereSql}
      GROUP BY ${groupExpr}
      ORDER BY ${groupExpr} ASC
    `;

    console.log('[API /aggregate] SQL Query:', {
      metric,
      groupBy,
      whereSql,
      params,
      fullQuery: sql.replace(/\s+/g, ' ').trim(),
      // ADD: Detailed filter breakdown
      receivedFilters: {
        vest: filters?.vest,
        vestType: typeof filters?.vest,
        areas: filters?.areas,
        areasLength: filters?.areas?.length,
        classes: filters?.classes,
        timeRange: filters?.timeRange
      }
    });

    const rows = await db.query(sql, params);

    const totalRow = await db.queryOne(`SELECT COUNT(*) AS count FROM detections`);
    const filteredRow = await db.queryOne(`SELECT COUNT(*) AS count FROM detections ${whereSql}`, params);
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
      timeParams.push(new Date(filters.timeRange.from).toISOString());
      humanWhereParts.push(`h.t >= $${timeParams.length}`);
      vehicleWhereParts.push(`v.t >= $${timeParams.length}`);
    }
    if (filters?.timeRange?.to) {
      timeParams.push(new Date(filters.timeRange.to).toISOString());
      humanWhereParts.push(`h.t <= $${timeParams.length}`);
      vehicleWhereParts.push(`v.t <= $${timeParams.length}`);
    }

    // Humans vs vehicles - use class field directly for accuracy
    humanWhereParts.push(`LOWER(h.class) = 'human'`);
    vehicleWhereParts.push(`LOWER(v.class) != 'human'`);

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
      SELECT strftime('%Y-%m-%dT%H:00:00Z', h.t) AS time, COUNT(*) AS value
      FROM humans h
      JOIN vehicles v
        ON strftime('%Y-%m-%dT%H:%M:%S', h.t) = strftime('%Y-%m-%dT%H:%M:%S', v.t)
       AND sqrt((h.x - v.x)*(h.x - v.x) + (h.y - v.y)*(h.y - v.y)) < $${timeParams.length + 1}
      GROUP BY strftime('%Y-%m-%dT%H:00:00Z', h.t)
      ORDER BY strftime('%Y-%m-%dT%H:00:00Z', h.t)
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
    const where: string[] = ['vest = 0', "class = 'human'"];
    const params: any[] = [];
    if (from) {
      params.push(new Date(from).toISOString().replace('T', ' ').replace('Z', ''));
      where.push(`t >= $${params.length}`);
    }
    if (to) {
      params.push(new Date(to).toISOString().replace('T', ' ').replace('Z', ''));
      where.push(`t <= $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `
      SELECT strftime('%Y-%m-%dT00:00:00Z', t) AS time, COUNT(*) AS value
      FROM detections
      ${whereSql}
      GROUP BY strftime('%Y-%m-%dT00:00:00Z', t)
      ORDER BY strftime('%Y-%m-%dT00:00:00Z', t)
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
      params.push(new Date(from).toISOString().replace('T', ' ').replace('Z', ''));
      where.push(`t >= $${params.length}`);
    }
    if (to) {
      params.push(new Date(to).toISOString().replace('T', ' ').replace('Z', ''));
      where.push(`t <= $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `
      SELECT class AS label, COUNT(*) AS value
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


