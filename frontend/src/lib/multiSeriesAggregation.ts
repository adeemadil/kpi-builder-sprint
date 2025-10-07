// Multi-series aggregation for displaying multiple classes as separate lines
import { UnifiedDetection } from './dataAdapter';
import { KPIConfig, filterData, calculateMetric } from './kpiCalculations';

export interface MultiSeriesData {
  label: string;
  timestamp?: string;
  [key: string]: number | string | undefined; // Dynamic keys for each class
}

// Aggregate data with separate series for each class
export function aggregateMultiSeries(
  allData: UnifiedDetection[],
  config: KPIConfig
): { data: MultiSeriesData[]; series: string[] } {
  const { filters, groupBy, timeBucket, metric } = config;

  // Create multi-series if multiple classes are selected (even when grouping by time)
  // Only skip multi-series if grouping explicitly by class
  if (filters.classes.length <= 1 || groupBy === 'class') {
    return { data: [], series: [] };
  }

  // Filter data for each class separately
  const classSeries: string[] = filters.classes;
  const timeGroups = new Map<string, Map<string, UnifiedDetection[]>>();

  classSeries.forEach(className => {
    // Filter for this specific class
    const classData = filterData(allData, {
      ...filters,
      classes: [className],
    });

    // Group by time or other dimension
    classData.forEach(detection => {
      let key: string;

      switch (groupBy) {
        case 'time_bucket':
          const date = new Date(detection.timestamp);
          switch (timeBucket) {
            case '1min':
              key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
              break;
            case '5min':
              const minutes5 = Math.floor(date.getMinutes() / 5) * 5;
              key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(minutes5).padStart(2, '0')}`;
              break;
            case '1hour':
              key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
              break;
            case '1day':
            default:
              key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              break;
          }
          break;
        case 'area':
          key = `Area ${detection.area}`;
          break;
        case 'asset_id':
          key = detection.id;
          break;
        case 'none':
          key = 'Total';
          break;
        default:
          key = 'Unknown';
      }

      if (!timeGroups.has(key)) {
        timeGroups.set(key, new Map());
      }
      const classMap = timeGroups.get(key)!;
      if (!classMap.has(className)) {
        classMap.set(className, []);
      }
      classMap.get(className)!.push(detection);
    });
  });

  // Build multi-series data
  const results: MultiSeriesData[] = [];
  
  timeGroups.forEach((classMap, label) => {
    const dataPoint: MultiSeriesData = {
      label,
      timestamp: groupBy === 'time_bucket' ? label : undefined,
    };

    classSeries.forEach(className => {
      const classData = classMap.get(className) || [];
      const value = calculateMetric(classData, metric, filters, allData);
      dataPoint[className] = Number(value.toFixed(2));
    });

    results.push(dataPoint);
  });

  // Sort results
  if (groupBy === 'time_bucket') {
    results.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  } else if (groupBy === 'asset_id') {
    // For asset IDs, show top 10 by total across all classes
    results.sort((a, b) => {
      const sumA = classSeries.reduce((sum, cls) => sum + (a[cls] as number || 0), 0);
      const sumB = classSeries.reduce((sum, cls) => sum + (b[cls] as number || 0), 0);
      return sumB - sumA;
    });
    return { data: results.slice(0, 10), series: classSeries };
  } else {
    results.sort((a, b) => {
      const sumA = classSeries.reduce((sum, cls) => sum + (a[cls] as number || 0), 0);
      const sumB = classSeries.reduce((sum, cls) => sum + (b[cls] as number || 0), 0);
      return sumB - sumA;
    });
  }

  return { data: results, series: classSeries };
}
