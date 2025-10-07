import { describe, it, expect } from 'vitest';
import { 
  filterData, 
  calculateMetric, 
  groupData, 
  aggregateData,
  KPIFilters,
  KPIConfig 
} from './kpiCalculations';
import { UnifiedDetection } from './dataAdapter';

// Mock data for testing
const mockDetections: UnifiedDetection[] = [
  {
    type: 'human',
    x: 10,
    y: 20,
    id: 'H1',
    speed: 1.2,
    heading: 90,
    area: 'A',
    vest: 1,
    with_object: false,
    timestamp: '2025-01-01T10:00:00Z',
  },
  {
    type: 'human',
    x: 12,
    y: 22,
    id: 'H1',
    speed: 1.5,
    heading: 90,
    area: 'A',
    vest: 0,
    with_object: false,
    timestamp: '2025-01-01T10:05:00Z',
  },
  {
    type: 'vehicle',
    x: 50,
    y: 60,
    id: 'V1',
    speed: 5.0,
    heading: 180,
    area: 'B',
    vest: 1,
    with_object: true,
    timestamp: '2025-01-01T10:10:00Z',
  },
  {
    type: 'pallet_truck',
    x: 55,
    y: 65,
    id: 'PT1',
    speed: 3.0,
    heading: 270,
    area: 'B',
    vest: 1,
    with_object: false,
    timestamp: '2025-01-01T11:00:00Z',
  },
];

describe('KPI Calculations', () => {
  describe('filterData', () => {
    const baseFilters: KPIFilters = {
      timeRange: {
        from: new Date('2025-01-01T00:00:00Z'),
        to: new Date('2025-01-01T23:59:59Z'),
      },
      classes: [],
    };

    it('should filter by time range', () => {
      const filters: KPIFilters = {
        ...baseFilters,
        timeRange: {
          from: new Date('2025-01-01T10:00:00Z'),
          to: new Date('2025-01-01T10:30:00Z'),
        },
      };
      const result = filterData(mockDetections, filters);
      expect(result).toHaveLength(3);
    });

    it('should filter by classes', () => {
      const filters: KPIFilters = {
        ...baseFilters,
        classes: ['human'],
      };
      const result = filterData(mockDetections, filters);
      expect(result).toHaveLength(2);
      expect(result.every(d => d.type === 'human')).toBe(true);
    });

    it('should filter by vest status', () => {
      const filters: KPIFilters = {
        ...baseFilters,
        classes: ['human'],
        vest: 0,
      };
      const result = filterData(mockDetections, filters);
      expect(result).toHaveLength(1);
      expect(result[0].vest).toBe(0);
    });

    it('should filter by speed minimum', () => {
      const filters: KPIFilters = {
        ...baseFilters,
        speedMin: 2.0,
      };
      const result = filterData(mockDetections, filters);
      expect(result).toHaveLength(2); // vehicle and pallet_truck
      expect(result.every(d => d.speed >= 2.0)).toBe(true);
    });

    it('should filter by areas', () => {
      const filters: KPIFilters = {
        ...baseFilters,
        areas: ['A'],
      };
      const result = filterData(mockDetections, filters);
      expect(result).toHaveLength(2);
      expect(result.every(d => d.area === 'A')).toBe(true);
    });

    it('should combine multiple filters', () => {
      const filters: KPIFilters = {
        ...baseFilters,
        classes: ['human'],
        vest: 1,
        areas: ['A'],
      };
      const result = filterData(mockDetections, filters);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('human');
      expect(result[0].vest).toBe(1);
      expect(result[0].area).toBe('A');
    });
  });

  describe('calculateMetric', () => {
    const baseFilters: KPIFilters = {
      timeRange: {
        from: new Date('2025-01-01T00:00:00Z'),
        to: new Date('2025-01-01T23:59:59Z'),
      },
      classes: [],
    };

    it('should calculate count metric', () => {
      const result = calculateMetric(mockDetections, 'count', baseFilters, mockDetections);
      expect(result).toBe(4);
    });

    it('should calculate unique_ids metric', () => {
      const result = calculateMetric(mockDetections, 'unique_ids', baseFilters, mockDetections);
      expect(result).toBe(3); // H1, V1, PT1
    });

    it('should calculate avg_speed metric', () => {
      const result = calculateMetric(mockDetections, 'avg_speed', baseFilters, mockDetections);
      expect(result).toBeCloseTo(2.675, 2); // (1.2 + 1.5 + 5.0 + 3.0) / 4
    });

    it('should return 0 for avg_speed with no data', () => {
      const result = calculateMetric([], 'avg_speed', baseFilters, []);
      expect(result).toBe(0);
    });

    it('should calculate rate metric (events per hour)', () => {
      const filters: KPIFilters = {
        timeRange: {
          from: new Date('2025-01-01T10:00:00Z'),
          to: new Date('2025-01-01T12:00:00Z'), // 2 hours
        },
        classes: [],
      };
      const result = calculateMetric(mockDetections, 'rate', filters, mockDetections);
      expect(result).toBe(2); // 4 events / 2 hours
    });

    it('should calculate vest_violations metric', () => {
      const result = calculateMetric(mockDetections, 'vest_violations', baseFilters, mockDetections);
      expect(result).toBe(1); // Only 1 human without vest
    });

    it('should calculate overspeed metric', () => {
      const filters: KPIFilters = {
        ...baseFilters,
        speedMin: 2.5,
      };
      const result = calculateMetric(mockDetections, 'overspeed', filters, mockDetections);
      expect(result).toBe(2); // vehicle (5.0) and pallet_truck (3.0)
    });
  });

  describe('groupData', () => {
    it('should group by none', () => {
      const result = groupData(mockDetections, 'none');
      expect(result.size).toBe(1);
      expect(result.get('Total')).toHaveLength(4);
    });

    it('should group by class', () => {
      const result = groupData(mockDetections, 'class');
      expect(result.size).toBe(3); // human, vehicle, pallet_truck
      expect(result.get('human')).toHaveLength(2);
      expect(result.get('vehicle')).toHaveLength(1);
      expect(result.get('pallet_truck')).toHaveLength(1);
    });

    it('should group by area', () => {
      const result = groupData(mockDetections, 'area');
      expect(result.size).toBe(2); // Area A, Area B
      expect(result.get('Area A')).toHaveLength(2);
      expect(result.get('Area B')).toHaveLength(2);
    });

    it('should group by asset_id', () => {
      const result = groupData(mockDetections, 'asset_id');
      expect(result.size).toBe(3); // H1, V1, PT1
      expect(result.get('H1')).toHaveLength(2);
      expect(result.get('V1')).toHaveLength(1);
      expect(result.get('PT1')).toHaveLength(1);
    });

    it('should group by time_bucket (1hour)', () => {
      const result = groupData(mockDetections, 'time_bucket', '1hour');
      expect(result.size).toBe(2); // 10:00 and 11:00
      expect(result.get('2025-01-01 10:00')).toHaveLength(3);
      expect(result.get('2025-01-01 11:00')).toHaveLength(1);
    });

    it('should group by time_bucket (1day)', () => {
      const result = groupData(mockDetections, 'time_bucket', '1day');
      expect(result.size).toBe(1);
      expect(result.get('2025-01-01')).toHaveLength(4);
    });
  });

  describe('aggregateData', () => {
    it('should aggregate count metric without grouping', () => {
      const config: KPIConfig = {
        metric: 'count',
        filters: {
          timeRange: {
            from: new Date('2025-01-01T00:00:00Z'),
            to: new Date('2025-01-01T23:59:59Z'),
          },
          classes: [],
        },
        groupBy: 'none',
      };
      const result = aggregateData(mockDetections, config);
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Total');
      expect(result[0].value).toBe(4);
    });

    it('should aggregate count metric grouped by class', () => {
      const config: KPIConfig = {
        metric: 'count',
        filters: {
          timeRange: {
            from: new Date('2025-01-01T00:00:00Z'),
            to: new Date('2025-01-01T23:59:59Z'),
          },
          classes: [],
        },
        groupBy: 'class',
      };
      const result = aggregateData(mockDetections, config);
      expect(result).toHaveLength(3);
      expect(result.find(r => r.label === 'human')?.value).toBe(2);
      expect(result.find(r => r.label === 'vehicle')?.value).toBe(1);
      expect(result.find(r => r.label === 'pallet_truck')?.value).toBe(1);
    });

    it('should aggregate avg_speed metric grouped by area', () => {
      const config: KPIConfig = {
        metric: 'avg_speed',
        filters: {
          timeRange: {
            from: new Date('2025-01-01T00:00:00Z'),
            to: new Date('2025-01-01T23:59:59Z'),
          },
          classes: [],
        },
        groupBy: 'area',
      };
      const result = aggregateData(mockDetections, config);
      expect(result).toHaveLength(2);
      
      const areaA = result.find(r => r.label === 'Area A');
      const areaB = result.find(r => r.label === 'Area B');
      
      expect(areaA?.value).toBeCloseTo(1.35, 2); // (1.2 + 1.5) / 2
      expect(areaB?.value).toBe(4); // (5.0 + 3.0) / 2
    });

    it('should sort results by value descending (except time_bucket)', () => {
      const config: KPIConfig = {
        metric: 'avg_speed',
        filters: {
          timeRange: {
            from: new Date('2025-01-01T00:00:00Z'),
            to: new Date('2025-01-01T23:59:59Z'),
          },
          classes: [],
        },
        groupBy: 'area',
      };
      const result = aggregateData(mockDetections, config);
      expect(result[0].value).toBeGreaterThan(result[1].value);
    });

    it('should limit asset_id results to top 10', () => {
      // Create 15 mock detections with different IDs
      const manyDetections: UnifiedDetection[] = Array.from({ length: 15 }, (_, i) => ({
        type: 'human',
        x: i,
        y: i,
        id: `ID${i}`,
        speed: i,
        heading: 0,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00Z',
      }));

      const config: KPIConfig = {
        metric: 'count',
        filters: {
          timeRange: {
            from: new Date('2025-01-01T00:00:00Z'),
            to: new Date('2025-01-01T23:59:59Z'),
          },
          classes: [],
        },
        groupBy: 'asset_id',
      };
      const result = aggregateData(manyDetections, config);
      expect(result.length).toBeLessThanOrEqual(10);
    });
  });
});
