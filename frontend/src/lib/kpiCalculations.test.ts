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
      expect(result).toBe(3);
    });

    it('should calculate unique_ids metric', () => {
      const result = calculateMetric(mockDetections, 'unique_ids', baseFilters, mockDetections);
      expect(result).toBe(2); // H1, V1
    });

    it('should calculate avg_speed metric', () => {
      const result = calculateMetric(mockDetections, 'avg_speed', baseFilters, mockDetections);
      expect(result).toBeCloseTo(2.57, 2); // (1.2 + 1.5 + 5.0) / 3
    });

    it('should calculate vest_violations metric', () => {
      const result = calculateMetric(mockDetections, 'vest_violations', baseFilters, mockDetections);
      expect(result).toBe(1); // Only 1 human without vest
    });
  });

  describe('groupData', () => {
    it('should group by none', () => {
      const result = groupData(mockDetections, 'none');
      expect(result.size).toBe(1);
      expect(result.get('Total')).toHaveLength(3);
    });

    it('should group by class', () => {
      const result = groupData(mockDetections, 'class');
      expect(result.size).toBe(2); // human, vehicle
      expect(result.get('human')).toHaveLength(2);
      expect(result.get('vehicle')).toHaveLength(1);
    });

    it('should group by area', () => {
      const result = groupData(mockDetections, 'area');
      expect(result.size).toBe(2); // Area A, Area B
      expect(result.get('Area A')).toHaveLength(2);
      expect(result.get('Area B')).toHaveLength(1);
    });
  });
});