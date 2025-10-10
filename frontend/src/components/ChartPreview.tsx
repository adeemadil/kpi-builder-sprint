import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AggregatedData, KPIConfig, MetricType } from '@/lib/kpiCalculations';
import { MultiSeriesData } from '@/lib/multiSeriesAggregation';
import { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTimestamp, formatTooltipLabel, formatLabel } from '@/lib/dateUtils';

interface ChartPreviewProps {
  data: AggregatedData[];
  multiSeriesData?: MultiSeriesData[];
  seriesKeys?: string[];
  chartType: 'line' | 'area' | 'bar' | 'table';
  isLoading: boolean;
  metric: MetricType;
  config: KPIConfig;
}

const metricLabels: Record<MetricType, string> = {
  count: 'Count',
  unique_ids: 'Unique IDs',
  avg_speed: 'Average Speed (m/s)',
  rate: 'Events per Hour',
  close_calls: 'Close Calls',
  vest_violations: 'Vest Violations',
  overspeed: 'Overspeed Events',
};

export function ChartPreview({ data, multiSeriesData, seriesKeys, chartType, isLoading, metric, config }: ChartPreviewProps) {
  const metricLabel = metricLabels[metric];
  const useMultiSeries = multiSeriesData && multiSeriesData.length > 0 && seriesKeys && seriesKeys.length > 1;
  // Memoized data formatting to prevent unnecessary re-renders
  const displayData = useMemo(() => {
    const dataToFormat = useMultiSeries ? (multiSeriesData || []) : data;
    return dataToFormat.map(item => ({
      ...item,
      label: config.groupBy === 'time_bucket' 
        ? formatTimestamp(item.label, config.groupBy, config.timeBucket as any)
        : formatLabel(item.label, config.groupBy)
    }));
  }, [data, multiSeriesData, useMultiSeries, config.groupBy, config.timeBucket]);
  
  // Chart colors for different series
  const colors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const exportToCSV = () => {
    if (useMultiSeries && multiSeriesData && seriesKeys) {
      const headers = ['Label', ...seriesKeys];
      const rows = multiSeriesData.map(d => [d.label, ...seriesKeys.map(key => d[key])]);
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kpi-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['Label', metricLabel];
      const rows = data.map(d => [d.label, d.value]);
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kpi-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle>Loading Preview...</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (displayData.length === 0 && !isLoading) {
    return (
      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle>No Data Available</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium">No data matches your filters</p>
              <p className="text-sm mt-2">Try adjusting your filter criteria</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>KPI Preview</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Showing {displayData.length} results{useMultiSeries ? ` across ${seriesKeys.length} classes` : ''}
            {config.groupBy === 'asset_id' && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                Top 10 (client-side)
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        {chartType === 'table' ? (
          <div className="rounded-md border max-h-[500px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  {useMultiSeries && seriesKeys ? (
                    seriesKeys.map(key => (
                      <TableHead key={key} className="text-right capitalize">{key.replace('_', ' ')}</TableHead>
                    ))
                  ) : (
                    <TableHead className="text-right">{metricLabel}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {useMultiSeries && multiSeriesData ? (
                  multiSeriesData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      {seriesKeys!.map(key => (
                        <TableCell key={key} className="text-right">{(row[key] as number)?.toLocaleString()  || 0}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  data.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="text-right">{row.value.toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            {chartType === 'line' ? (
              <LineChart 
                data={displayData}
                margin={{ top: 5, right: 30, left: 20, bottom: displayData.length > 10 ? 90 : 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="label" 
                  stroke="hsl(var(--foreground))"
                  angle={displayData.length > 10 ? -45 : 0}
                  textAnchor={displayData.length > 10 ? 'end' : 'middle'}
                  height={displayData.length > 10 ? 80 : 30}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  stroke="hsl(var(--foreground))"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                  }}
                  labelFormatter={(label) => {
                    // Find the original data point by matching the formatted label
                    const originalData = data.find(d => {
                      const formattedLabel = config.groupBy === 'time_bucket' 
                        ? formatTimestamp(d.label, config.groupBy, config.timeBucket as any)
                        : formatLabel(d.label, config.groupBy);
                      return formattedLabel === label;
                    });
                    if (originalData?.timestamp) {
                      return formatTooltipLabel(originalData.timestamp);
                    }
                    // If no timestamp found, return the formatted label as-is
                    return label;
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="line"
                />
                {useMultiSeries && seriesKeys ? (
                  seriesKeys.map((key, idx) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={colors[idx % colors.length]}
                      strokeWidth={2}
                      dot={{ fill: colors[idx % colors.length] }}
                      name={key.replace('_', ' ')}
                    />
                  ))
                ) : (
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-1))' }}
                    name={metricLabel}
                  />
                )}
              </LineChart>
            ) : chartType === 'area' ? (
              <AreaChart 
                data={displayData}
                margin={{ top: 5, right: 30, left: 20, bottom: displayData.length > 10 ? 90 : 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="label" 
                  stroke="hsl(var(--foreground))"
                  angle={displayData.length > 10 ? -45 : 0}
                  textAnchor={displayData.length > 10 ? 'end' : 'middle'}
                  height={displayData.length > 10 ? 80 : 30}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  stroke="hsl(var(--foreground))"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                  }}
                  labelFormatter={(label) => {
                    // Find the original data point by matching the formatted label
                    const originalData = data.find(d => {
                      const formattedLabel = config.groupBy === 'time_bucket' 
                        ? formatTimestamp(d.label, config.groupBy, config.timeBucket as any)
                        : formatLabel(d.label, config.groupBy);
                      return formattedLabel === label;
                    });
                    if (originalData?.timestamp) {
                      return formatTooltipLabel(originalData.timestamp);
                    }
                    // If no timestamp found, return the formatted label as-is
                    return label;
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="rect"
                />
                {useMultiSeries && seriesKeys ? (
                  seriesKeys.map((key, idx) => (
                    <Area
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={colors[idx % colors.length]}
                      fill={colors[idx % colors.length]}
                      fillOpacity={0.3}
                      name={key.replace('_', ' ')}
                    />
                  ))
                ) : (
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--chart-1))"
                    fill="hsl(var(--chart-1))"
                    fillOpacity={0.3}
                    name={metricLabel}
                  />
                )}
              </AreaChart>
            ) : (
              <BarChart 
                data={displayData}
                margin={{ top: 5, right: 30, left: 20, bottom: displayData.length > 10 ? 90 : 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="label" 
                  stroke="hsl(var(--foreground))"
                  angle={displayData.length > 10 ? -45 : 0}
                  textAnchor={displayData.length > 10 ? 'end' : 'middle'}
                  height={displayData.length > 10 ? 80 : 30}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  stroke="hsl(var(--foreground))"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                  }}
                  labelFormatter={(label) => {
                    // Find the original data point by matching the formatted label
                    const originalData = data.find(d => {
                      const formattedLabel = config.groupBy === 'time_bucket' 
                        ? formatTimestamp(d.label, config.groupBy, config.timeBucket as any)
                        : formatLabel(d.label, config.groupBy);
                      return formattedLabel === label;
                    });
                    if (originalData?.timestamp) {
                      return formatTooltipLabel(originalData.timestamp);
                    }
                    // If no timestamp found, return the formatted label as-is
                    return label;
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="rect"
                />
                {useMultiSeries && seriesKeys ? (
                  seriesKeys.map((key, idx) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      fill={colors[idx % colors.length]}
                      radius={[4, 4, 0, 0]}
                      name={key.replace('_', ' ')}
                    />
                  ))
                ) : (
                  <Bar
                    dataKey="value"
                    fill="hsl(var(--chart-1))"
                    radius={[4, 4, 0, 0]}
                    name={metricLabel}
                  />
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
