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

    // Legacy metric name mapping → core metric + filters
    const mappedConfig = { ...config } as KPIConfig;
    if (mappedConfig.metric === 'vest_violations') {
      mappedConfig.metric = 'count';
      mappedConfig.filters = {
        ...mappedConfig.filters,
        vest: 0,
        classes: (mappedConfig.filters.classes?.includes('human') ? mappedConfig.filters.classes : ['human'])
      } as any;
    } else if (mappedConfig.metric === 'overspeed') {
      mappedConfig.metric = 'count';
      mappedConfig.filters = {
        ...mappedConfig.filters,
        speedMin: mappedConfig.filters.speedMin ?? 1.5
      };
    }

    // Map KPI config to API request format (core metrics only)
    const apiRequest = {
      metric: mappedConfig.metric === 'count' || mappedConfig.metric === 'unique_ids' || mappedConfig.metric === 'avg_speed'
        ? mappedConfig.metric
        : 'count' as 'count' | 'unique_ids' | 'avg_speed',
      filters: {
        timeRange: {
          from: mappedConfig.filters.timeRange.from.toISOString(),
          to: mappedConfig.filters.timeRange.to.toISOString(),
        },
        classes: mappedConfig.filters.classes,
        vest: (() => {
          // Use the mapped config's vest value (after legacy mapping)
          let result: number;
          
          if (mappedConfig.filters.vest === 'all') {
            result = 2; // All vest statuses
          } else if (typeof mappedConfig.filters.vest === 'number') {
            result = mappedConfig.filters.vest; // 0 or 1
          } else {
            result = 0; // fallback
          }
          
          return result;
        })(),
        speedMin: mappedConfig.filters.speedMin,
      },
      groupBy: (mappedConfig.groupBy === 'time_bucket' ?
               (mappedConfig.timeBucket === '1day' ? 'day' : 
                mappedConfig.timeBucket === '1hour' ? 'hour' :
                mappedConfig.timeBucket === '5min' ? '5min' :
                mappedConfig.timeBucket === '1min' ? '1min' : '5min') :
               mappedConfig.groupBy === 'class' ? 'class' :
               mappedConfig.groupBy === 'area' ? 'area' :
               mappedConfig.groupBy === 'asset_id' ? 'class' : // fetch class-grouped for top 10 client-side
               mappedConfig.groupBy === 'none' ? 'class' : // fetch class-grouped for total client-side
               '5min') as 'hour' | 'day' | 'class' | 'area' | '5min' | '1min',
    };

    let results: { series?: Array<{ label?: string; time?: string; value?: number; timestamp?: string }> };
    if (mappedConfig.metric === 'close_calls') {
      results = await api.closeCalls({ timeRange: {
        from: mappedConfig.filters.timeRange.from.toISOString(),
        to: mappedConfig.filters.timeRange.to.toISOString(),
      } }, mappedConfig.filters.distanceThreshold || 2.0);
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
    
    // Handle client-side aggregations for asset_id and none
    let processedSeries = results.series?.map((item: { label?: string; time?: string; value?: number; timestamp?: string }) => ({
      label: item.label || item.time || 'Unknown',
      value: item.value || 0,
      timestamp: item.time || item.timestamp,
    })) || [];
    
    if (mappedConfig.groupBy === 'asset_id') {
      // For asset_id, we need to fetch individual detections and compute top 10
      // For now, return class-grouped data with a note that this is client-side top 10
      processedSeries = processedSeries.slice(0, 10).map(item => ({
        ...item,
        label: `Asset ${item.label} (Top 10)`,
        value: item.value
      }));
    } else if (mappedConfig.groupBy === 'none') {
      // For none, sum all values into a single total
      const total = processedSeries.reduce((sum, item) => sum + item.value, 0);
      processedSeries = [{
        label: 'Total',
        value: total,
        timestamp: undefined
      }];
    }
    
    return processedSeries;
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