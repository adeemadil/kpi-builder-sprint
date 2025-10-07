// Test database connection string (use a separate test database)
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 
  'postgresql://kpi_user:kpi_password@localhost:5432/kpi_builder_test';

let db: typeof import('../db');

// Setup runs before all tests
beforeAll(async () => {
  try {
    db = await import('../db');
    // Connect to test database
    await db.query('SELECT 1');
    // eslint-disable-next-line no-console
    console.log('✅ Test database connected');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Test database connection failed:', error);
    process.exit(1);
  }
});

// Cleanup after all tests
afterAll(async () => {
  await db.close();
  // eslint-disable-next-line no-console
  console.log('✅ Test database connection closed');
});

// Helper to truncate tables between tests (optional)
export async function cleanDatabase() {
  await db.query('TRUNCATE detections CASCADE');
}

// Helper to insert test data
export async function insertTestDetections(count: number = 10) {
  const detections: Array<{ id: string; class: string; t: string; x: number; y: number; speed: number; heading: number; vest: number; }> = [];
  for (let i = 0; i < count; i++) {
    detections.push({
      id: `TEST_${i}`,
      class: i % 2 === 0 ? 'human' : 'vehicle',
      t: new Date(2025, 0, 1, 8 + i).toISOString(),
      x: 10 + i,
      y: 20 + i,
      speed: 1.0 + (i * 0.1),
      heading: 45,
      vest: i % 3 === 0 ? 0 : 1,
    });
  }
  
  for (const det of detections) {
    await db.query(
      'INSERT INTO detections (id, class, t, x, y, speed, heading, vest) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [det.id, det.class, det.t, det.x, det.y, det.speed, det.heading, det.vest]
    );
  }
  
  return detections;
}


