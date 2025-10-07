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
});