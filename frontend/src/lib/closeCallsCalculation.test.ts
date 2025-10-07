import { describe, it, expect } from 'vitest';
import { calculateCloseCalls } from './closeCallsCalculation';
import { UnifiedDetection } from './dataAdapter';

describe('Close Calls Calculation', () => {
  it('should detect close calls when human and vehicle are close', () => {
    const data: UnifiedDetection[] = [
      {
        type: 'human',
        x: 10,
        y: 10,
        id: 'H1',
        speed: 1.0,
        heading: 0,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.000Z',
      },
      {
        type: 'vehicle',
        x: 11,
        y: 10,
        id: 'V1',
        speed: 5.0,
        heading: 90,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.100Z', // Same time window
      },
    ];

    const result = calculateCloseCalls(data, 2.0, 250);
    expect(result).toHaveLength(1);
    expect(result[0].distance).toBeCloseTo(1.0, 1);
    expect(result[0].humanId).toBe('H1');
    expect(result[0].vehicleId).toBe('V1');
  });

  it('should not detect close calls when distance exceeds threshold', () => {
    const data: UnifiedDetection[] = [
      {
        type: 'human',
        x: 10,
        y: 10,
        id: 'H1',
        speed: 1.0,
        heading: 0,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.000Z',
      },
      {
        type: 'vehicle',
        x: 15,
        y: 10,
        id: 'V1',
        speed: 5.0,
        heading: 90,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.100Z',
      },
    ];

    const result = calculateCloseCalls(data, 2.0, 250);
    expect(result).toHaveLength(0);
  });

  it('should calculate distance correctly using Euclidean formula', () => {
    const data: UnifiedDetection[] = [
      {
        type: 'human',
        x: 0,
        y: 0,
        id: 'H1',
        speed: 1.0,
        heading: 0,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.000Z',
      },
      {
        type: 'vehicle',
        x: 3,
        y: 4,
        id: 'V1',
        speed: 5.0,
        heading: 90,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.100Z',
      },
    ];

    const result = calculateCloseCalls(data, 10.0, 250);
    expect(result).toHaveLength(1);
    expect(result[0].distance).toBe(5.0); // sqrt(3^2 + 4^2) = 5
  });

  it('should group detections by time windows', () => {
    const data: UnifiedDetection[] = [
      {
        type: 'human',
        x: 10,
        y: 10,
        id: 'H1',
        speed: 1.0,
        heading: 0,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.000Z',
      },
      {
        type: 'vehicle',
        x: 11,
        y: 10,
        id: 'V1',
        speed: 5.0,
        heading: 90,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.100Z', // Within 250ms window
      },
      {
        type: 'vehicle',
        x: 11,
        y: 10,
        id: 'V2',
        speed: 5.0,
        heading: 90,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:01.000Z', // Different time window (1000ms later)
      },
    ];

    const result = calculateCloseCalls(data, 2.0, 250);
    expect(result).toHaveLength(1); // Only V1 should be in same window as H1
    expect(result[0].vehicleId).toBe('V1');
  });

  it('should detect close calls with pallet_truck and agv', () => {
    const data: UnifiedDetection[] = [
      {
        type: 'human',
        x: 10,
        y: 10,
        id: 'H1',
        speed: 1.0,
        heading: 0,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.000Z',
      },
      {
        type: 'pallet_truck',
        x: 11,
        y: 10,
        id: 'PT1',
        speed: 3.0,
        heading: 90,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.100Z',
      },
      {
        type: 'agv',
        x: 10,
        y: 11,
        id: 'AGV1',
        speed: 2.0,
        heading: 180,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.150Z',
      },
    ];

    const result = calculateCloseCalls(data, 2.0, 250);
    expect(result).toHaveLength(2); // One with PT1, one with AGV1
    const vehicleIds = result.map(cc => cc.vehicleId);
    expect(vehicleIds).toContain('PT1');
    expect(vehicleIds).toContain('AGV1');
  });

  it('should handle empty data gracefully', () => {
    const result = calculateCloseCalls([], 2.0, 250);
    expect(result).toHaveLength(0);
  });

  it('should handle data with only humans', () => {
    const data: UnifiedDetection[] = [
      {
        type: 'human',
        x: 10,
        y: 10,
        id: 'H1',
        speed: 1.0,
        heading: 0,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.000Z',
      },
      {
        type: 'human',
        x: 11,
        y: 10,
        id: 'H2',
        speed: 1.0,
        heading: 0,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.100Z',
      },
    ];

    const result = calculateCloseCalls(data, 2.0, 250);
    expect(result).toHaveLength(0);
  });

  it('should handle data with only vehicles', () => {
    const data: UnifiedDetection[] = [
      {
        type: 'vehicle',
        x: 10,
        y: 10,
        id: 'V1',
        speed: 5.0,
        heading: 0,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.000Z',
      },
      {
        type: 'vehicle',
        x: 11,
        y: 10,
        id: 'V2',
        speed: 5.0,
        heading: 0,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.100Z',
      },
    ];

    const result = calculateCloseCalls(data, 2.0, 250);
    expect(result).toHaveLength(0);
  });

  it('should use custom distance threshold', () => {
    const data: UnifiedDetection[] = [
      {
        type: 'human',
        x: 10,
        y: 10,
        id: 'H1',
        speed: 1.0,
        heading: 0,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.000Z',
      },
      {
        type: 'vehicle',
        x: 11.5,
        y: 10,
        id: 'V1',
        speed: 5.0,
        heading: 90,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.100Z',
      },
    ];

    // With threshold 1.0, should not detect
    const result1 = calculateCloseCalls(data, 1.0, 250);
    expect(result1).toHaveLength(0);

    // With threshold 2.0, should detect
    const result2 = calculateCloseCalls(data, 2.0, 250);
    expect(result2).toHaveLength(1);
  });

  it('should use custom time window', () => {
    const data: UnifiedDetection[] = [
      {
        type: 'human',
        x: 10,
        y: 10,
        id: 'H1',
        speed: 1.0,
        heading: 0,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.000Z',
      },
      {
        type: 'vehicle',
        x: 11,
        y: 10,
        id: 'V1',
        speed: 5.0,
        heading: 90,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.300Z', // 300ms later
      },
    ];

    // With 250ms window, should not detect
    const result1 = calculateCloseCalls(data, 2.0, 250);
    expect(result1).toHaveLength(0);

    // With 500ms window, should detect
    const result2 = calculateCloseCalls(data, 2.0, 500);
    expect(result2).toHaveLength(1);
  });

  it('should detect multiple close calls in the same time window', () => {
    const data: UnifiedDetection[] = [
      {
        type: 'human',
        x: 10,
        y: 10,
        id: 'H1',
        speed: 1.0,
        heading: 0,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.000Z',
      },
      {
        type: 'human',
        x: 20,
        y: 20,
        id: 'H2',
        speed: 1.0,
        heading: 0,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.050Z',
      },
      {
        type: 'vehicle',
        x: 11,
        y: 10,
        id: 'V1',
        speed: 5.0,
        heading: 90,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.100Z',
      },
      {
        type: 'vehicle',
        x: 21,
        y: 20,
        id: 'V2',
        speed: 5.0,
        heading: 90,
        area: 'A',
        vest: 1,
        with_object: false,
        timestamp: '2025-01-01T10:00:00.150Z',
      },
    ];

    const result = calculateCloseCalls(data, 2.0, 250);
    expect(result).toHaveLength(2);
  });
});
