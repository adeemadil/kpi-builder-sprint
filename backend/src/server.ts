import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import * as db from './db';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// CORS (development: allow all)
app.use(cors());

// JSON body parsing
app.use(express.json());

// Mount API routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  // eslint-disable-next-line no-console
  console.warn(`[server] 404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error('[server] Unhandled error:', err);
  const message = err?.message || 'Internal server error';
  res.status(500).json({ error: message });
});

async function start(): Promise<void> {
  try {
    // eslint-disable-next-line no-console
    console.log('🔌 Connecting to database...');

    // Check if database is properly seeded
    const isSeeded = await db.isDatabaseSeeded();
    if (!isSeeded) {
      // eslint-disable-next-line no-console
      console.error('❌ Database is not seeded. Please run the seeding script first.');
      console.log('💡 Run: python3 backend/data/seed_sqlite.py');
      process.exit(1);
    } else {
      // eslint-disable-next-line no-console
      console.log('✅ Database connection verified');
    }

    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`🚀 API server running on http://localhost:${PORT}`);
      // eslint-disable-next-line no-console
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`${signal} received, shutting down...`);
  try {
    await db.close();
    // eslint-disable-next-line no-console
    console.log('🔒 Database pool closed. Bye!');
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Start the server
void start();


