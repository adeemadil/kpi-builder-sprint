import sqlite3 from 'sqlite3';
import { open, Database as SqliteDb } from 'sqlite';
import path from 'path';

// Initialize SQLite database (file-based)
const DB_PATH = process.env.SQLITE_PATH || path.resolve(__dirname, '..', 'data', 'kpi_builder.sqlite');
let dbPromise: Promise<SqliteDb> | null = null;

async function getDb(): Promise<SqliteDb> {
  if (!dbPromise) {
    dbPromise = open({ filename: DB_PATH, driver: sqlite3.Database }).then(async (db) => {
      await db.exec("PRAGMA journal_mode = WAL;");
      return db;
    });
  }
  return dbPromise;
}

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
  try {
    const normalizedSql = sql.replace(/\$\d+/g, '?');
    logInfo(`query: ${normalizedSql.replace(/\s+/g, ' ').trim()} | params: ${JSON.stringify(params)}`);
    const db = await getDb();
    return db.all(normalizedSql, params);
  } catch (err) {
    logError('query failed', err);
    throw err;
  }
}

export async function queryOne(sql: string, params: any[] = []): Promise<any | null> {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function close(): Promise<void> {
  try {
    const db = await getDb();
    await db.close();
    logInfo('db closed');
  } catch (err) {
    logError('error closing db', err);
    throw err;
  }
}

export async function isDatabaseSeeded(): Promise<boolean> {
  try {
    // Check table existence in SQLite
    const existsRow = await queryOne(
      `SELECT name AS reg FROM sqlite_master WHERE type='table' AND name='detections';`
    );
    if (!existsRow || !existsRow.reg) {
      logInfo("detections table doesn't exist yet");
      return false;
    }

    // Check row count
    const countRow = await queryOne(`SELECT COUNT(*) AS count FROM detections;`);
    const count = (countRow?.count as number) || 0;
    logInfo(`detections row count: ${count}`);
    return count > 0;
  } catch (err) {
    // If any error occurs (e.g., table missing), treat as not seeded
    logError('isDatabaseSeeded check failed', err);
    return false;
  }
}

export default {
  query,
  queryOne,
  close,
  isDatabaseSeeded,
};


