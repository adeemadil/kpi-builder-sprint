import request from 'supertest';
import { app } from '../server';

describe('Ground Truth Validation Tests (Real Database)', () => {
  // Ground truth numbers from work-package-raw-data.csv
  const GROUND_TRUTH = {
    TOTAL_HUMAN: 28323,
    HUMAN_NO_VEST: 10312,
    HUMAN_WITH_VEST: 18011
  };

  const fullTimeRange = {
    from: '2025-04-02T00:00:00Z',
    to: '2025-04-02T23:59:59Z'
  };

  describe('Vest Filter Ground Truth Tests', () => {
    test('Vest Violations KPI should return exactly 10,312 records', async () => {
      const response = await request(app)
        .post('/api/aggregate')
        .send({
          metric: 'vest_violations',
          filters: {
            timeRange: fullTimeRange
          },
          groupBy: 'day'
        });

      expect(response.status).toBe(200);
      expect(response.body.series).toHaveLength(1);
      expect(response.body.series[0].value).toBe(GROUND_TRUTH.HUMAN_NO_VEST);
      expect(response.body.meta.filteredRecords).toBe(GROUND_TRUTH.HUMAN_NO_VEST);
    }, 15000);

    test('Vest filter "No Vest" (vest=0) should return exactly 10,312 records', async () => {
      const response = await request(app)
        .post('/api/aggregate')
        .send({
          metric: 'count',
          filters: {
            timeRange: fullTimeRange,
            classes: ['human'],
            vest: 0
          },
          groupBy: 'day'
        });

      expect(response.status).toBe(200);
      expect(response.body.series).toHaveLength(1);
      expect(response.body.series[0].value).toBe(GROUND_TRUTH.HUMAN_NO_VEST);
      expect(response.body.meta.filteredRecords).toBe(GROUND_TRUTH.HUMAN_NO_VEST);
    }, 15000);

    test('Vest filter "Wearing Vest" (vest=1) should return exactly 18,011 records', async () => {
      const response = await request(app)
        .post('/api/aggregate')
        .send({
          metric: 'count',
          filters: {
            timeRange: fullTimeRange,
            classes: ['human'],
            vest: 1
          },
          groupBy: 'day'
        });

      expect(response.status).toBe(200);
      expect(response.body.series).toHaveLength(1);
      expect(response.body.series[0].value).toBe(GROUND_TRUTH.HUMAN_WITH_VEST);
      expect(response.body.meta.filteredRecords).toBe(GROUND_TRUTH.HUMAN_WITH_VEST);
    }, 15000);

    test('Vest filter "All" (vest=2) should return exactly 28,323 records', async () => {
      const response = await request(app)
        .post('/api/aggregate')
        .send({
          metric: 'count',
          filters: {
            timeRange: fullTimeRange,
            classes: ['human'],
            vest: 2
          },
          groupBy: 'day'
        });

      expect(response.status).toBe(200);
      expect(response.body.series).toHaveLength(1);
      expect(response.body.series[0].value).toBe(GROUND_TRUTH.TOTAL_HUMAN);
      expect(response.body.meta.filteredRecords).toBe(GROUND_TRUTH.TOTAL_HUMAN);
    }, 15000);
  });
});
