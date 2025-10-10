// Adapter to transform API schema to match existing calculations
import { KPIConfig } from './kpiCalculations';

// Unified detection type for calculations
export interface UnifiedDetection {
  type: 'human' | 'vehicle' | 'pallet_truck' | 'agv';
  x: number;
  y: number;
  id: string;
  speed: number;
  heading: number;
  area: string;
  vest: 0 | 1;
  with_object: boolean;
  timestamp: string;
}

// Query backend API for aggregated data
export async function queryDetections(config: KPIConfig): Promise<Array<{ label: string; value: number; timestamp?: string }>> {
  try {
    console.log('Querying backend with config:', config);

    // Import api dynamically to avoid circular dependencies
    const { api } = await import('./api');

    // Map KPI config to API request format
    const apiRequest = {
      metric: config.metric === 'count' || config.metric === 'unique_ids' || config.metric === 'avg_speed'
        ? config.metric
        : 'count' as 'count' | 'unique_ids' | 'avg_speed',
      filters: {
        timeRange: {
          from: config.filters.timeRange.from.toISOString(),
          to: config.filters.timeRange.to.toISOString(),
        },
        classes: config.filters.classes,
        vest: config.filters.vest === 'all' ? undefined : config.filters.vest,
        speedMin: config.filters.speedMin,
      },
      groupBy: (config.groupBy === 'time_bucket' ?
               (config.timeBucket === '1day' ? 'day' : 
                config.timeBucket === '1hour' ? 'hour' :
                config.timeBucket === '5min' ? '5min' :
                config.timeBucket === '1min' ? '1min' : '5min') :
               config.groupBy === 'class' ? 'class' : '5min') as 'hour' | 'day' | 'class' | '5min' | '1min',
    };

    let results: { series?: Array<{ label?: string; time?: string; value?: number; timestamp?: string }> };
    if (config.metric === 'close_calls') {
      results = await api.closeCalls({ timeRange: {
        from: config.filters.timeRange.from.toISOString(),
        to: config.filters.timeRange.to.toISOString(),
      } }, config.filters.distanceThreshold || 2.0);
    } else if (config.metric === 'vest_violations') {
      // Use aggregate to respect selected time bucket (backend will enforce vest=0 & class='human')
      results = await api.aggregate({
        ...apiRequest,
        metric: 'vest_violations'
      });
    } else if (config.metric === 'overspeed') {
      results = await api.overspeed(
        config.filters.timeRange.from.toISOString(),
        config.filters.timeRange.to.toISOString(),
        config.filters.speedMin || 1.5,
      );
    } else if (config.metric === 'rate') {
      // For rate, use count and calculate rate manually
      const countResults = await api.aggregate({
        ...apiRequest,
        metric: 'count'
      });
      // Calculate rate (events per hour)
      const timeRangeHours =
        (config.filters.timeRange.to.getTime() - config.filters.timeRange.from.getTime()) / (1000 * 60 * 60);
      results = {
        series: countResults.series?.map((item: { label?: string; time?: string; value?: number; timestamp?: string }) => ({
          ...item,
          value: item.value / Math.max(timeRangeHours, 1)
        })) || []
      };
    } else {
      results = await api.aggregate(apiRequest);
    }

    console.log(`Query completed, processed ${results.series?.length || 0} data points`);
    return results.series?.map((item: { label?: string; time?: string; value?: number; timestamp?: string }) => ({
      label: item.label || item.time || 'Unknown',
      value: item.value || 0,
      timestamp: item.time || item.timestamp,
    })) || [];
  } catch (error) {
    console.error('Failed to query detections:', error);
    throw new Error(
      'Failed to query data from backend. Please check:\n' +
      '1. Backend connection is configured\n' +
      '2. Data has been loaded into database\n' +
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}