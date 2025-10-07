import { Pool, PoolClient, QueryResult } from 'pg';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Initialize a connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'kpi_builder',
  user: process.env.DB_USER || 'kpi_user',
  password: process.env.DB_PASSWORD || 'kpi_password',
  max: 10,
  idleTimeoutMillis: 30000,
});

function logInfo(message: string): void {
  // Centralized logging for DB operations
  // eslint-disable-next-line no-console
  console.log(`[db] ${message}`);
}

function logError(message: string, error?: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[db] ${message}`, error);
}

export async function query(sql: string, params: any[] = []): Promise<any[]> {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    logInfo(`query: ${sql.replace(/\s+/g, ' ').trim()} | params: ${JSON.stringify(params)}`);
    const result: QueryResult = await client.query(sql, params);
    return result.rows;
  } catch (err) {
    logError('query failed', err);
    throw err;
  } finally {
    if (client) client.release();
  }
}

export async function queryOne(sql: string, params: any[] = []): Promise<any | null> {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function close(): Promise<void> {
  try {
    await pool.end();
    logInfo('pool closed');
  } catch (err) {
    logError('error closing pool', err);
    throw err;
  }
}

export async function isDatabaseSeeded(): Promise<boolean> {
  try {
    // Check table existence
    const existsRow = await queryOne(
      `SELECT to_regclass('public.detections') AS reg;`
    );
    if (!existsRow || !existsRow.reg) {
      logInfo("detections table doesn't exist yet");
      return false;
    }

    // Check row count
    const countRow = await queryOne(`SELECT COUNT(*)::int AS count FROM detections;`);
    const count = (countRow?.count as number) || 0;
    logInfo(`detections row count: ${count}`);
    return count > 0;
  } catch (err) {
    // If any error occurs (e.g., table missing), treat as not seeded
    logError('isDatabaseSeeded check failed', err);
    return false;
  }
}

export async function seedDatabase(): Promise<number> {
  const client = await pool.connect();
  try {
    // 1) Ensure schema exists
    const schemaPath = path.resolve(__dirname, '..', 'data', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    logInfo(`Executing schema from ${schemaPath}`);

    await client.query('BEGIN');
    for (const statement of splitSqlStatements(schemaSql)) {
      if (statement.trim().length === 0) continue;
      await client.query(statement);
    }
    await client.query('COMMIT');
    logInfo('Schema applied');

    // 2) Stream CSV and insert in batches
    const csvPath = path.resolve(__dirname, '..', 'data', 'work-package-raw-data.csv');
    if (!fs.existsSync(csvPath)) {
      logError(`CSV not found at ${csvPath}`);
      return 0;
    }

    const fileStream = fs.createReadStream(csvPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let header: string[] | null = null;
    let batch: Array<any[]> = [];
    let totalInserted = 0;
    let lineNumber = 0;

    for await (const line of rl) {
      lineNumber += 1;
      if (lineNumber === 1) {
        header = parseCsvLine(line);
        continue;
      }

      if (!header) continue;
      const fields = parseCsvLine(line);
      if (fields.length === 0) continue;

      const record = mapCsvToRecord(header, fields);
      if (!record) continue; // skip malformed

      batch.push(record);

      if (batch.length >= 1000) {
        const inserted = await insertBatch(client, batch);
        totalInserted += inserted;
        batch = [];
        if (totalInserted % 10000 === 0) {
          logInfo(`Inserted ${totalInserted} rows so far...`);
        }
      }
    }

    if (batch.length > 0) {
      const inserted = await insertBatch(client, batch);
      totalInserted += inserted;
    }

    logInfo(`Seeding complete. Total rows inserted: ${totalInserted}`);
    return totalInserted;
  } catch (err) {
    logError('seedDatabase failed', err);
    throw err;
  } finally {
    client.release();
  }
}

function splitSqlStatements(sql: string): string[] {
  // Naive splitter by semicolon not inside strings. Good enough for schema files.
  const statements: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const prev = i > 0 ? sql[i - 1] : '';
    if (ch === "'" && prev !== '\\' && !inDouble) inSingle = !inSingle;
    if (ch === '"' && prev !== '\\' && !inSingle) inDouble = !inDouble;
    if (ch === ';' && !inSingle && !inDouble) {
      statements.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) statements.push(current);
  return statements.map(s => s.trim());
}

function parseCsvLine(line: string): string[] {
  // Simple CSV parser supporting quoted fields with commas
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map(v => v.trim());
}

type CsvRecord = [
  id: string,
  klass: string,
  t: Date,
  x: number,
  y: number,
  heading: number | null,
  vest: number | null,
  speed: number | null
];

function mapCsvToRecord(header: string[], fields: string[]): CsvRecord | null {
  const indexOf = (name: string): number => header.findIndex(h => h.toLowerCase() === name.toLowerCase());

  const idIdx = indexOf('id');
  const typeIdx = indexOf('type'); // maps to class
  const tsIdx = indexOf('timestamp'); // maps to t
  const xIdx = indexOf('x');
  const yIdx = indexOf('y');
  const headingIdx = indexOf('heading');
  const vestIdx = indexOf('vest');
  const speedIdx = indexOf('speed');

  if (idIdx < 0 || typeIdx < 0 || tsIdx < 0 || xIdx < 0 || yIdx < 0) {
    return null;
  }

  const id = fields[idIdx];
  const klass = fields[typeIdx];
  const tRaw = fields[tsIdx];
  const xRaw = fields[xIdx];
  const yRaw = fields[yIdx];
  const headingRaw = headingIdx >= 0 ? fields[headingIdx] : '';
  const vestRaw = vestIdx >= 0 ? fields[vestIdx] : '';
  const speedRaw = speedIdx >= 0 ? fields[speedIdx] : '';

  if (!id || !klass || !tRaw || !xRaw || !yRaw) return null;

  const t = new Date(tRaw);
  if (Number.isNaN(t.getTime())) return null;

  const x = toNumberOrNull(xRaw);
  const y = toNumberOrNull(yRaw);
  const heading = toNumberOrNull(headingRaw);
  const vest = toNumberOrNull(vestRaw);
  const speed = toNumberOrNull(speedRaw);

  if (x === null || y === null) return null;

  return [id, klass, t, x, y, heading, vest, speed];
}

function toNumberOrNull(v: string | undefined): number | null {
  if (v === undefined || v === null) return null;
  const trimmed = String(v).trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

async function insertBatch(client: PoolClient, batch: Array<any[]>): Promise<number> {
  if (batch.length === 0) return 0;

  const columns = ['id', 'class', 't', 'x', 'y', 'heading', 'vest', 'speed'];
  const valuesPerRow = columns.length;
  const params: any[] = [];
  const valuesSql: string[] = [];

  batch.forEach((row, rowIdx) => {
    const placeholders: string[] = [];
    for (let i = 0; i < valuesPerRow; i += 1) {
      params.push(row[i]);
      placeholders.push(`$${rowIdx * valuesPerRow + i + 1}`);
    }
    valuesSql.push(`(${placeholders.join(',')})`);
  });

  const sql = `INSERT INTO detections (${columns.join(',')}) VALUES ${valuesSql.join(',')}`;

  try {
    await client.query('BEGIN');
    await client.query(sql, params);
    await client.query('COMMIT');
    return batch.length;
  } catch (err) {
    await client.query('ROLLBACK');
    logError('insertBatch failed', err);
    throw err;
  }
}

export default {
  query,
  queryOne,
  close,
  isDatabaseSeeded,
  seedDatabase,
};


