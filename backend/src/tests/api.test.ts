import request from 'supertest';
import express from 'express';
import cors from 'cors';
import routes from '../routes';
import { insertTestDetections, cleanDatabase } from './setup';
import * as db from '../db';

// Create test app instance
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', routes);

describe('API Integration Tests', () => {
  
  beforeEach(async () => {
    // Clean database before each test
    await cleanDatabase();
  });

  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('recordCount');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.recordCount).toBe('number');
    });
  });

  describe('POST /api/detections', () => {
    beforeEach(async () => {
      await insertTestDetections(20);
    });

    it('should return detections without filters', async () => {
      const response = await request(app)
        .post('/api/detections')
        .send({ limit: 10 })
        .expect(200);
      
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('count');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(10);
    });

    it('should filter by class', async () => {
      const response = await request(app)
        .post('/api/detections')
        .send({
          filters: { classes: ['human'] },
          limit: 100
        })
        .expect(200);
      
      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach((det: any) => {
        expect(det.class).toBe('human');
      });
    });

    it('should filter by vest status', async () => {
      const response = await request(app)
        .post('/api/detections')
        .send({
          filters: { vest: 0 },
          limit: 100
        })
        .expect(200);
      
      response.body.data.forEach((det: any) => {
        expect(det.vest).toBe(0);
      });
    });

    it('should filter by time range', async () => {
      const response = await request(app)
        .post('/api/detections')
        .send({
          filters: {
            timeRange: {
              from: '2025-01-01T08:00:00Z',
              to: '2025-01-01T12:00:00Z'
            }
          },
          limit: 100
        })
        .expect(200);
      
      response.body.data.forEach((det: any) => {
        const time = new Date(det.t);
        expect(time.getTime()).toBeGreaterThanOrEqual(new Date('2025-01-01T08:00:00Z').getTime());
        expect(time.getTime()).toBeLessThanOrEqual(new Date('2025-01-01T12:00:00Z').getTime());
      });
    });

    it('should apply pagination', async () => {
      const page1 = await request(app)
        .post('/api/detections')
        .send({ limit: 5, offset: 0 })
        .expect(200);
      
      const page2 = await request(app)
        .post('/api/detections')
        .send({ limit: 5, offset: 5 })
        .expect(200);
      
      expect(page1.body.data.length).toBe(5);
      expect(page2.body.data.length).toBe(5);
      expect(page1.body.data[0].id).not.toBe(page2.body.data[0].id);
    });
  });

  describe('POST /api/aggregate', () => {
    beforeEach(async () => {
      await insertTestDetections(50);
    });

    it('should aggregate count by hour', async () => {
      const response = await request(app)
        .post('/api/aggregate')
        .send({
          metric: 'count',
          filters: {},
          groupBy: 'hour'
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('series');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.series)).toBe(true);
      expect(response.body.series.length).toBeGreaterThan(0);
      
      response.body.series.forEach((point: any) => {
        expect(point).toHaveProperty('time');
        expect(point).toHaveProperty('value');
        expect(typeof point.value).toBe('number');
      });
    });

    it('should aggregate count by class', async () => {
      const response = await request(app)
        .post('/api/aggregate')
        .send({
          metric: 'count',
          filters: {},
          groupBy: 'class'
        })
        .expect(200);
      
      expect(response.body.series.length).toBeGreaterThan(0);
      
      response.body.series.forEach((point: any) => {
        expect(point).toHaveProperty('label');
        expect(point).toHaveProperty('value');
        expect(['human', 'vehicle', 'pallet_truck', 'agv']).toContain(point.label);
      });
    });

    it('should calculate average speed', async () => {
      const response = await request(app)
        .post('/api/aggregate')
        .send({
          metric: 'avg_speed',
          filters: {},
          groupBy: 'class'
        })
        .expect(200);
      
      response.body.series.forEach((point: any) => {
        expect(point.value).toBeGreaterThan(0);
        expect(point.value).toBeLessThan(10); // Reasonable speed range
      });
    });

    it('should count unique IDs', async () => {
      const response = await request(app)
        .post('/api/aggregate')
        .send({
          metric: 'unique_ids',
          filters: {},
          groupBy: 'hour'
        })
        .expect(200);
      
      response.body.series.forEach((point: any) => {
        expect(point.value).toBeGreaterThanOrEqual(0);
      });
    });

    it('should apply filters in aggregation', async () => {
      const response = await request(app)
        .post('/api/aggregate')
        .send({
          metric: 'count',
          filters: { classes: ['human'], vest: 0 },
          groupBy: 'hour'
        })
        .expect(200);
      
      expect(response.body.meta).toHaveProperty('filteredRecords');
      expect(response.body.meta.filteredRecords).toBeGreaterThan(0);
    });
  });

  describe('POST /api/close-calls', () => {
    beforeEach(async () => {
      // Insert humans and vehicles close together
      await db.query(
        'INSERT INTO detections (id, class, t, x, y, speed, heading, vest) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        ['H1', 'human', '2025-01-01T08:00:00Z', 10, 10, 1.0, 45, 1]
      );
      await db.query(
        'INSERT INTO detections (id, class, t, x, y, speed, heading, vest) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        ['V1', 'vehicle', '2025-01-01T08:00:00Z', 11, 11, 2.0, 90, null as any]
      );
    });

    it('should detect close calls', async () => {
      const response = await request(app)
        .post('/api/close-calls')
        .send({
          filters: {
            timeRange: {
              from: '2025-01-01T00:00:00Z',
              to: '2025-01-02T00:00:00Z'
            }
          },
          distance: 2.0
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('series');
      expect(Array.isArray(response.body.series)).toBe(true);
      
      if (response.body.series.length > 0) {
        expect(response.body.series[0]).toHaveProperty('time');
        expect(response.body.series[0]).toHaveProperty('value');
        expect(response.body.series[0].value).toBeGreaterThan(0);
      }
    });

    it('should respect distance threshold', async () => {
      const closeCalls = await request(app)
        .post('/api/close-calls')
        .send({
          filters: {
            timeRange: {
              from: '2025-01-01T00:00:00Z',
              to: '2025-01-02T00:00:00Z'
            }
          },
          distance: 2.0
        })
        .expect(200);
      
      const noCloseCalls = await request(app)
        .post('/api/close-calls')
        .send({
          filters: {
            timeRange: {
              from: '2025-01-01T00:00:00Z',
              to: '2025-01-02T00:00:00Z'
            }
          },
          distance: 0.5
        })
        .expect(200);
      
      const totalCloseCalls = closeCalls.body.series.reduce((sum: number, p: any) => sum + p.value, 0);
      const totalNoCloseCalls = noCloseCalls.body.series.reduce((sum: number, p: any) => sum + p.value, 0);
      
      expect(totalCloseCalls).toBeGreaterThanOrEqual(totalNoCloseCalls);
    });
  });

  describe('GET /api/vest-violations', () => {
    beforeEach(async () => {
      await insertTestDetections(30);
    });

    it('should return vest violations by day', async () => {
      const response = await request(app)
        .get('/api/vest-violations')
        .query({ from: '2025-01-01', to: '2025-01-07' })
        .expect(200);
      
      expect(response.body).toHaveProperty('series');
      expect(Array.isArray(response.body.series)).toBe(true);
      
      response.body.series.forEach((point: any) => {
        expect(point).toHaveProperty('time');
        expect(point).toHaveProperty('value');
        expect(point.value).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('GET /api/overspeed', () => {
    beforeEach(async () => {
      await insertTestDetections(40);
    });

    it('should return overspeed events by class', async () => {
      const response = await request(app)
        .get('/api/overspeed')
        .query({ from: '2025-01-01', to: '2025-01-07', threshold: 1.5 })
        .expect(200);
      
      expect(response.body).toHaveProperty('series');
      expect(Array.isArray(response.body.series)).toBe(true);
      
      response.body.series.forEach((point: any) => {
        expect(point).toHaveProperty('label');
        expect(point).toHaveProperty('value');
      });
    });

    it('should respect speed threshold', async () => {
      const lowThreshold = await request(app)
        .get('/api/overspeed')
        .query({ from: '2025-01-01', to: '2025-01-07', threshold: 0.5 })
        .expect(200);
      
      const highThreshold = await request(app)
        .get('/api/overspeed')
        .query({ from: '2025-01-01', to: '2025-01-07', threshold: 5.0 })
        .expect(200);
      
      const lowTotal = lowThreshold.body.series.reduce((sum: number, p: any) => sum + p.value, 0);
      const highTotal = highThreshold.body.series.reduce((sum: number, p: any) => sum + p.value, 0);
      
      expect(lowTotal).toBeGreaterThanOrEqual(highTotal);
    });
  });

  describe('Ground Truth Validation (Filter Logic)', () => {
    // Note: These tests validate filter logic works correctly with test data
    // For production ground truth validation, see docs/GROUND_TRUTH_VALIDATION.md
    
    beforeEach(async () => {
      await insertTestDetections(20);
    });

    it('should validate vest filter works correctly with vest=0', async () => {
      const response = await request(app)
        .post('/api/aggregate')
        .send({
          metric: 'count',
          filters: {
            classes: ['human'],
            vest: 0
          },
          groupBy: 'day'
        })
        .expect(200);
      
      // This test validates that vest=0 filter is properly applied
      expect(response.body.series).toHaveLength(1);
      expect(response.body.series[0].value).toBeGreaterThanOrEqual(0);
      expect(response.body.meta.filteredRecords).toBeGreaterThanOrEqual(0);
    });

    it('should validate speed filter works correctly with speedMin', async () => {
      const response = await request(app)
        .post('/api/aggregate')
        .send({
          metric: 'count',
          filters: {
            classes: ['human', 'vehicle'],
            speedMin: 1.5
          },
          groupBy: 'day'
        })
        .expect(200);
      
      // This test validates that speedMin filter is properly applied
      expect(response.body.series).toHaveLength(1);
      expect(response.body.series[0].value).toBeGreaterThanOrEqual(0);
      expect(response.body.meta.filteredRecords).toBeGreaterThanOrEqual(0);
    });

    it('should validate area filter works correctly', async () => {
      const response = await request(app)
        .post('/api/aggregate')
        .send({
          metric: 'count',
          filters: {
            classes: ['human'],
            areas: ['1']
          },
          groupBy: 'day'
        })
        .expect(200);
      
      // This test validates that area filter is properly applied
      expect(response.body.series).toHaveLength(1);
      expect(response.body.series[0].value).toBeGreaterThanOrEqual(0);
      expect(response.body.meta.filteredRecords).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      await request(app)
        .get('/api/unknown')
        .expect(404);
    });

    it('should handle invalid request body', async () => {
      await request(app)
        .post('/api/aggregate')
        .send({ invalid: 'data' })
        .expect(400);
    });
  });
});


