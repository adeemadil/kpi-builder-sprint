import { calculateCloseCalls } from './closeCallsCalculation';
import type { UnifiedDetection } from './dataAdapter';

export type MetricType =
  | 'count' 
  | 'unique_ids' 
  | 'avg_speed' 
  | 'rate' 
  | 'close_calls' 
  // legacy names kept for backward-compat load/mapping only
  | 'vest_violations' 
  | 'overspeed';

export type GroupByType = 
  | 'none' 
  | 'time_bucket' 
  | 'class' 
  | 'area' 
  | 'asset_id';

export interface KPIFilters {
  timeRange: {
    from: Date;
    to: Date;
  };
  classes: string[];
  vest?: 0 | 1 | 'all';
  speedMin?: number;
  speedMax?: number;
  distanceThreshold?: number;
  areas?: string[];
}

export interface KPIConfig {
  metric: MetricType;
  filters: KPIFilters;
  groupBy: GroupByType;
  timeBucket?: '1min' | '5min' | '1hour' | '1day';
}

export interface AggregatedData {
  label: string;
  value: number;
  timestamp?: string;
}

// Filter data based on KPI filters
export function filterData(data: UnifiedDetection[], filters: KPIFilters): UnifiedDetection[] {
  return data.filter(detection => {
    // Time range filter
    const detectionTime = new Date(detection.timestamp);
    if (detectionTime < filters.timeRange.from || detectionTime > filters.timeRange.to) {
      return false;
    }

    // Class filter
    if (filters.classes.length > 0 && !filters.classes.includes(detection.type)) {
      return false;
    }

    // Vest filter (only for humans)
    if (filters.vest !== undefined && filters.vest !== 'all') {
      // When vest filter is active, only show humans
      if (detection.type !== 'human') {
        return false;
      }
      // And only humans with matching vest status
      if (detection.vest !== filters.vest) {
        return false;
      }
    }

    // Speed filter
    if (filters.speedMin !== undefined && detection.speed < filters.speedMin) {
      return false;
    }
    if (filters.speedMax !== undefined && detection.speed > filters.speedMax) {
      return false;
    }

    // Area filter
    if (filters.areas && filters.areas.length > 0 && !filters.areas.includes(detection.area)) {
      return false;
    }

    return true;
  });
}

// Calculate metric based on filtered data
export function calculateMetric(
  data: UnifiedDetection[],
  metric: MetricType,
  filters: KPIFilters,
  allData: UnifiedDetection[]
): number {
  switch (metric) {
    case 'count':
      return data.length;
    
    case 'unique_ids':
      return new Set(data.map(d => d.id)).size;
    
    case 'avg_speed':
      if (data.length === 0) return 0;
      return data.reduce((sum, d) => sum + d.speed, 0) / data.length;
    
    case 'rate': {
      // Events per hour
      if (data.length === 0) return 0;
      const timeRangeHours = 
        (filters.timeRange.to.getTime() - filters.timeRange.from.getTime()) / (1000 * 60 * 60);
      return data.length / Math.max(timeRangeHours, 1);
    }
    
    case 'close_calls': {
      const closeCalls = calculateCloseCalls(
        filterData(allData, { ...filters, classes: [] }), // Need all classes for close calls
        filters.distanceThreshold || 2.0
      );
      return closeCalls.filter(cc => {
        const ccTime = new Date(cc.timestamp);
        return ccTime >= filters.timeRange.from && ccTime <= filters.timeRange.to;
      }).length;
    }
    
    case 'vest_violations':
      return data.filter(d => d.type === 'human' && d.vest === 0).length;
    
    case 'overspeed':
      return data.filter(d => d.speed > (filters.speedMin || 1.5)).length;
    
    default:
      return 0;
  }
}

// Group data based on groupBy parameter
export function groupData(
  data: UnifiedDetection[],
  groupBy: GroupByType,
  timeBucket?: string
): Map<string, UnifiedDetection[]> {
  const grouped = new Map<string, UnifiedDetection[]>();

  if (groupBy === 'none') {
    grouped.set('Total', data);
    return grouped;
  }

  data.forEach(detection => {
    let key: string;

    switch (groupBy) {
      case 'class':
        key = detection.type;
        break;
      
      case 'area':
        key = `Area ${detection.area}`;
        break;
      
      case 'asset_id':
        key = detection.id;
        break;
      
      case 'time_bucket': {
        const date = new Date(detection.timestamp);
        switch (timeBucket) {
          case '1min':
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            break;
          case '5min': {
            const minutes5 = Math.floor(date.getMinutes() / 5) * 5;
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(minutes5).padStart(2, '0')}`;
            break;
          }
          case '1hour':
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
            break;
          case '1day':
          default:
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            break;
        }
        break;
      }
      
      default:
        key = 'Unknown';
    }

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(detection);
  });

  return grouped;
}

// Aggregate data based on KPI configuration
export function aggregateData(
  allData: UnifiedDetection[],
  config: KPIConfig
): AggregatedData[] {
  // Filter data
  const filteredData = filterData(allData, config.filters);

  // Group data
  const grouped = groupData(
    filteredData,
    config.groupBy,
    config.timeBucket
  );

  // Calculate metrics for each group
  const results: AggregatedData[] = [];

  grouped.forEach((groupData, label) => {
    const value = calculateMetric(groupData, config.metric, config.filters, allData);
    
    results.push({
      label,
      value: Number(value.toFixed(2)),
      timestamp: config.groupBy === 'time_bucket' ? label : undefined,
    });
  });

  // Sort results
  if (config.groupBy === 'time_bucket') {
    results.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  } else if (config.groupBy === 'asset_id') {
    // For asset IDs, show top 10
    results.sort((a, b) => b.value - a.value);
    return results.slice(0, 10);
  } else {
    results.sort((a, b) => b.value - a.value);
  }

  return results;
}
