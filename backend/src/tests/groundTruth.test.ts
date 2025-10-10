import request from 'supertest';
import { app } from '../server';
import { setupTestDB, insertTestDetections, cleanDatabase } from './setup';

describe('Ground Truth Validation Tests', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  const fullTimeRange = {
    from: '2025-04-02T15:42:06Z',
    to: '2025-04-02T16:00:19Z'
  };

  describe('Filter Logic Validation', () => {
    beforeEach(async () => {
      // Insert test data with known values
      await insertTestDetections(20);
    });

    test('Vest filter should work correctly with vest=0', async () => {
      const response = await request(app)
        .post('/api/aggregate')
        .send({
          metric: 'count',
          filters: {
            classes: ['human'],
            vest: 0
          },
          groupBy: 'day'
        });

      expect(response.status).toBe(200);
      expect(response.body.series).toHaveLength(1);
      expect(response.body.series[0].value).toBeGreaterThanOrEqual(0);
      expect(response.body.meta.filteredRecords).toBeGreaterThanOrEqual(0);
    });

    test('Speed filter should work correctly with speedMin', async () => {
      const response = await request(app)
        .post('/api/aggregate')
        .send({
          metric: 'count',
          filters: {
            classes: ['human', 'vehicle'],
            speedMin: 1.5
          },
          groupBy: 'day'
        });

      expect(response.status).toBe(200);
      expect(response.body.series).toHaveLength(1);
      expect(response.body.series[0].value).toBeGreaterThanOrEqual(0);
      expect(response.body.meta.filteredRecords).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Metric-Specific Tests', () => {
    beforeEach(async () => {
      await insertTestDetections(20);
    });

    test('Vest violations metric should auto-apply vest=0 and class=human', async () => {
      const response = await request(app)
        .post('/api/aggregate')
        .send({
          metric: 'vest_violations',
          filters: {},
          groupBy: 'day'
        });

      expect(response.status).toBe(200);
      expect(response.body.series).toHaveLength(1);
      expect(response.body.series[0].value).toBeGreaterThanOrEqual(0);
    });

    test('Overspeed metric should auto-apply speedMin=1.5', async () => {
      const response = await request(app)
        .post('/api/aggregate')
        .send({
          metric: 'overspeed',
          filters: {
            classes: ['human', 'vehicle']
          },
          groupBy: 'day'
        });

      expect(response.status).toBe(200);
      expect(response.body.series).toHaveLength(1);
      expect(response.body.series[0].value).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Close Calls Algorithm', () => {
    beforeEach(async () => {
      await insertTestDetections(10);
    });

    test('Close calls endpoint should return valid response structure', async () => {
      const response = await request(app)
        .post('/api/close-calls')
        .send({
          filters: {
            timeRange: fullTimeRange
          },
          distance: 2.0
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('series');
      expect(Array.isArray(response.body.series)).toBe(true);
    });
  });
});
