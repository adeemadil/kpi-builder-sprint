import { describe, it, expect } from 'vitest';

// This mirrors the UI → backend mapping logic in KPIBuilder
function mapGroupBy(uiGroupBy: 'time_bucket' | 'class' | 'area' | 'asset_id' | 'none', timeBucket?: '1min' | '5min' | '1hour' | '1day') {
  if (uiGroupBy === 'time_bucket') {
    switch (timeBucket) {
      case '1day': return 'day';
      case '1hour': return 'hour';
      case '5min': return '5min';
      case '1min': return '1min';
      default: return '5min';
    }
  }
  if (uiGroupBy === 'class') return 'class';
  // Fallback for non-time bucket groupings not supported by backend directly
  return '5min' as const;
}

describe('GroupBy transform mapping', () => {
  it('maps time_bucket 1day → day', () => {
    expect(mapGroupBy('time_bucket', '1day')).toBe('day');
  });
  it('maps time_bucket 1hour → hour', () => {
    expect(mapGroupBy('time_bucket', '1hour')).toBe('hour');
  });
  it('maps time_bucket 5min → 5min', () => {
    expect(mapGroupBy('time_bucket', '5min')).toBe('5min');
  });
  it('maps class → class', () => {
    expect(mapGroupBy('class')).toBe('class');
  });
});


