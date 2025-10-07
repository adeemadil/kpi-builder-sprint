import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon, Table as TableIcon, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { KPIConfig, MetricType, GroupByType } from '@/lib/kpiCalculations';
import { ChartPreview } from './ChartPreview';
import { SaveKPIDialog } from './SaveKPIDialog';

interface KPIBuilderProps {
  onBack: () => void;
  initialConfig?: KPIConfig;
}

// Local API response types to avoid using any
type ApiSeriesItem = { label?: string; time?: string; value?: number; timestamp?: string };
type ApiResponse = { series?: ApiSeriesItem[] };

export function KPIBuilder({ onBack, initialConfig }: KPIBuilderProps) {
  const [aggregatedData, setAggregatedData] = useState<{label: string; value: number; timestamp?: string}[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const isLoadingFromConfig = useRef(false);
  
  // KPI Configuration State
  const [metric, setMetric] = useState<MetricType>(initialConfig?.metric || 'count');
  const [timePreset, setTimePreset] = useState<string>('data-day');
  const [customTimeRange, setCustomTimeRange] = useState<{ from: Date; to: Date }>({
    from: new Date('2025-04-02T00:00:00.000Z'),
    to: new Date('2025-04-02T23:59:59.999Z'),
  });
  const [selectedClasses, setSelectedClasses] = useState<string[]>(initialConfig?.filters.classes || ['human', 'vehicle']);
  const [selectedAreas, setSelectedAreas] = useState<string[]>(initialConfig?.filters.areas || []);
  const [vestFilter, setVestFilter] = useState<0 | 1 | 'all'>('all');
  const [speedThreshold, setSpeedThreshold] = useState<number>(1.5);
  const [distanceThreshold, setDistanceThreshold] = useState<number>(2.0);
  const [groupBy, setGroupBy] = useState<GroupByType>(initialConfig?.groupBy || 'time_bucket');
  const [timeBucket, setTimeBucket] = useState<'1min' | '5min' | '1hour' | '1day'>('5min');
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar' | 'table'>('line');
  const [isLoading, setIsLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Load initial config when it changes
  useEffect(() => {
    if (initialConfig) {
      isLoadingFromConfig.current = true;
      setMetric(initialConfig.metric);
      setSelectedClasses(initialConfig.filters.classes || []);
      setSelectedAreas(initialConfig.filters.areas || []);
      setVestFilter(initialConfig.filters.vest ?? 'all');
      setSpeedThreshold(initialConfig.filters.speedMin ?? 1.5);
      setDistanceThreshold(initialConfig.filters.distanceThreshold ?? 2.0);
      setGroupBy(initialConfig.groupBy);
      setTimeBucket(initialConfig.timeBucket || '1hour');
      // Important: mark preset as custom so the preset effect does not overwrite loaded dates
      setTimePreset('custom');
      setCustomTimeRange(initialConfig.filters.timeRange);
      // Reset flag after all updates complete
      setTimeout(() => {
        isLoadingFromConfig.current = false;
      }, 0);
    }
  }, [initialConfig]);

  // Calculate time range based on preset
  useEffect(() => {
    // Skip when loading from a saved KPI/config or when using a custom preset
    if (isLoadingFromConfig.current || timePreset === 'custom') return;
    
    let from: Date;
    let to: Date;

    switch (timePreset) {
      case 'data-period':
        // Full data period: 15:42:06 to 16:00:18 on April 2, 2025
        from = new Date('2025-04-02T15:42:06.000Z');
        to = new Date('2025-04-02T16:00:18.000Z');
        break;
      case 'data-hour':
        // Data hour: 15:00 to 16:00 on April 2, 2025
        from = new Date('2025-04-02T15:00:00.000Z');
        to = new Date('2025-04-02T16:00:00.000Z');
        break;
      case 'data-day':
        // Full day: April 2, 2025 (00:00 to 23:59)
        from = new Date('2025-04-02T00:00:00.000Z');
        to = new Date('2025-04-02T23:59:59.999Z');
        break;
      default:
        return;
    }

    setCustomTimeRange({ from, to });
  }, [timePreset]);

  // Build KPI configuration - memoized to prevent unnecessary re-renders
  const kpiConfig = useMemo<KPIConfig>(() => ({
    metric,
    filters: {
      timeRange: customTimeRange,
      classes: selectedClasses,
      areas: selectedAreas.length > 0 ? selectedAreas : undefined,
      vest: vestFilter,
      speedMin: metric === 'overspeed' ? speedThreshold : undefined,
      distanceThreshold: metric === 'close_calls' ? distanceThreshold : undefined,
    },
    groupBy,
    timeBucket: groupBy === 'time_bucket' ? timeBucket : undefined,
  }), [metric, customTimeRange, selectedClasses, selectedAreas, vestFilter, speedThreshold, distanceThreshold, groupBy, timeBucket]);

  // Apply filters and query backend
  const handleApplyFilters = async () => {
    if (selectedClasses.length === 0) {
      setQueryError('Please select at least one class');
      return;
    }

    setIsQuerying(true);
    setQueryError(null);

    try {
      // Ensure Date objects for timeRange (guard against strings in initialConfig)
      const fromDate = new Date(kpiConfig.filters.timeRange.from as unknown as string | number | Date);
      const toDate = new Date(kpiConfig.filters.timeRange.to as unknown as string | number | Date);
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        throw new Error('Invalid time range');
      }
      // Map KPI config to API request format
      const apiRequest = {
        metric: kpiConfig.metric,
        filters: {
          timeRange: {
            from: fromDate.toISOString(),
            to: toDate.toISOString(),
          },
          classes: kpiConfig.filters.classes,
          vest: kpiConfig.filters.vest === 'all' ? undefined : kpiConfig.filters.vest,
          speedMin: kpiConfig.filters.speedMin,
        },
        groupBy: (kpiConfig.groupBy === 'time_bucket' ? 
                 (timeBucket === '1day' ? 'day' : 
                  timeBucket === '1hour' ? 'hour' :
                  timeBucket === '5min' ? '5min' :
                  timeBucket === '1min' ? '1min' : '5min') : 
                 kpiConfig.groupBy === 'class' ? 'class' : '5min') as 'hour' | 'day' | 'class' | '5min' | '1min',
      };
      
      let results: ApiResponse;
      if (kpiConfig.metric === 'close_calls') {
        results = await api.closeCalls({ timeRange: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        } }, distanceThreshold);
      } else if (kpiConfig.metric === 'vest_violations') {
        results = await api.vestViolations(
          fromDate.toISOString(),
          toDate.toISOString(),
        );
      } else if (kpiConfig.metric === 'overspeed') {
        results = await api.overspeed(
          fromDate.toISOString(),
          toDate.toISOString(),
          speedThreshold,
        );
      } else if (kpiConfig.metric === 'rate') {
        // For rate, use count and calculate rate manually
        const countResults = (await api.aggregate({
          ...apiRequest,
          metric: 'count'
        })) as ApiResponse;
        // Calculate rate (events per hour)
        const timeRangeHours = 
          (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60);
        results = {
          series: countResults.series?.map((item: ApiSeriesItem) => ({
            ...item,
            value: (item.value ?? 0) / Math.max(timeRangeHours, 1)
          })) || []
        };
      } else {
        // For count, unique_ids, avg_speed - use aggregate directly
        const supportedMetric = kpiConfig.metric === 'count' || kpiConfig.metric === 'unique_ids' || kpiConfig.metric === 'avg_speed' 
          ? kpiConfig.metric 
          : 'count';
        results = await api.aggregate({
          ...apiRequest,
          metric: supportedMetric
        });
      }
      
      // Transform API response to match expected format
      const transformedData = results.series?.map((item: ApiSeriesItem) => ({
        label: item.label || item.time || 'Unknown',
        value: item.value ?? 0,
        timestamp: item.time || item.timestamp,
      })) || [];
      
      setAggregatedData(transformedData);
      setHasApplied(true);
    } catch (error) {
      console.error('Query failed:', error);
      setQueryError(error instanceof Error ? error.message : 'Failed to query data');
    } finally {
      setIsQuerying(false);
    }
  };

  // Load initial config data when initialConfig changes
  useEffect(() => {
    if (initialConfig) {
      // Reset state to ensure fresh data
      setAggregatedData([]);
      setHasApplied(false);
      // Apply filters after a brief delay to ensure state updates complete
      setTimeout(() => {
        handleApplyFilters();
      }, 100);
    }
  }, [initialConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const allClasses = ['human', 'vehicle'];

  // Available areas (from actual data)
  const availableAreas = useMemo(() => {
    return ['1', '2', '3', '4', '5', '7', '8', '9', '11', '12', '13'];
  }, []);

  const toggleClass = (className: string) => {
    setSelectedClasses(prev =>
      prev.includes(className)
        ? prev.filter(c => c !== className)
        : [...prev, className]
    );
  };

  const toggleArea = (area: string) => {
    setSelectedAreas(prev =>
      prev.includes(area)
        ? prev.filter(a => a !== area)
        : [...prev, area]
    );
  };

  const selectAllAreas = () => setSelectedAreas([...availableAreas]);
  const selectNoAreas = () => setSelectedAreas([]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Configuration Form */}
        <div className="space-y-4">
          {/* Metric Selection */}
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="text-base">1. Select Metric</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={metric} onValueChange={(v) => setMetric(v as MetricType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Count of Events</SelectItem>
                  <SelectItem value="unique_ids">Unique Asset IDs</SelectItem>
                  <SelectItem value="avg_speed">Average Speed</SelectItem>
                  <SelectItem value="rate">Events per Hour</SelectItem>
                  <SelectItem value="close_calls">Close Calls</SelectItem>
                  <SelectItem value="vest_violations">Vest Violations</SelectItem>
                  <SelectItem value="overspeed">Overspeed Events</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="text-base">2. Apply Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Time Range */}
              <div className="space-y-2">
                <Label>Time Range</Label>
                <Select value={timePreset} onValueChange={setTimePreset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="data-period">Full Data Period (18 min)</SelectItem>
                    <SelectItem value="data-hour">Data Hour (15:00-16:00)</SelectItem>
                    <SelectItem value="data-day">Full Day (April 2, 2025)</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Class Filter */}
              <div className="space-y-2">
                <Label>Classes</Label>
                <div className="space-y-2">
                  {allClasses.map(className => (
                    <div key={className} className="flex items-center space-x-2">
                      <Checkbox
                        id={className}
                        checked={selectedClasses.includes(className)}
                        onCheckedChange={() => toggleClass(className)}
                      />
                      <label
                        htmlFor={className}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize cursor-pointer"
                      >
                        {className.replace('_', ' ')}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Area/Zone Filter */}
              {availableAreas.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>
                      Areas/Zones {selectedAreas.length > 0 && `(${selectedAreas.length} selected)`}
                    </Label>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectAllAreas}
                        className="h-6 px-2 text-xs"
                      >
                        All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectNoAreas}
                        className="h-6 px-2 text-xs"
                      >
                        None
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {availableAreas.map(area => (
                      <div key={area} className="flex items-center space-x-2">
                        <Checkbox
                          id={`area-${area}`}
                          checked={selectedAreas.includes(area)}
                          onCheckedChange={() => toggleArea(area)}
                        />
                        <label
                          htmlFor={`area-${area}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {area}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vest Filter (for human metrics) */}
              {(metric === 'vest_violations' || selectedClasses.includes('human')) && (
                <div className="space-y-2">
                  <Label>Vest Status</Label>
                  <Select value={String(vestFilter)} onValueChange={(v) => setVestFilter(v === 'all' ? 'all' : (v === '1' ? 1 : 0))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="1">Wearing Vest</SelectItem>
                      <SelectItem value="0">No Vest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Speed Threshold (for overspeed) */}
              {metric === 'overspeed' && (
                <div className="space-y-2">
                  <Label>Speed Threshold: {speedThreshold.toFixed(1)} m/s</Label>
                  <Slider
                    value={[speedThreshold]}
                    onValueChange={(v) => setSpeedThreshold(v[0])}
                    min={0.5}
                    max={5.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              )}

              {/* Distance Threshold (for close calls) */}
              {metric === 'close_calls' && (
                <div className="space-y-2">
                  <Label>Distance Threshold: {distanceThreshold.toFixed(1)} m</Label>
                  <Slider
                    value={[distanceThreshold]}
                    onValueChange={(v) => setDistanceThreshold(v[0])}
                    min={0.5}
                    max={5.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grouping */}
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="text-base">3. Group By</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time_bucket">Time Bucket</SelectItem>
                  <SelectItem value="class">Class</SelectItem>
                  <SelectItem value="area">Area/Zone</SelectItem>
                  <SelectItem value="asset_id">Asset ID (Top 10)</SelectItem>
                  <SelectItem value="none">None (Total)</SelectItem>
                </SelectContent>
              </Select>

              {groupBy === 'time_bucket' && (
                <Select value={timeBucket} onValueChange={(v) => setTimeBucket(v as '1min' | '5min' | '1hour' | '1day')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1min">1 Minute</SelectItem>
                    <SelectItem value="5min">5 Minutes</SelectItem>
                    <SelectItem value="1hour">1 Hour</SelectItem>
                    <SelectItem value="1day">1 Day</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Chart Type */}
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="text-base">4. Visualization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={chartType === 'line' ? 'default' : 'outline'}
                  onClick={() => setChartType('line')}
                  className="gap-2"
                >
                  <LineChartIcon className="h-4 w-4" />
                  Line
                </Button>
                <Button
                  variant={chartType === 'area' ? 'default' : 'outline'}
                  onClick={() => setChartType('area')}
                  className="gap-2"
                >
                  <AreaChartIcon className="h-4 w-4" />
                  Area
                </Button>
                <Button
                  variant={chartType === 'bar' ? 'default' : 'outline'}
                  onClick={() => setChartType('bar')}
                  className="gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  Bar
                </Button>
                <Button
                  variant={chartType === 'table' ? 'default' : 'outline'}
                  onClick={() => setChartType('table')}
                  className="gap-2"
                >
                  <TableIcon className="h-4 w-4" />
                  Table
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Apply Filters Button */}
          <Button
            onClick={handleApplyFilters}
            className="w-full gap-2"
            size="lg"
            disabled={isQuerying || selectedClasses.length === 0}
          >
            {isQuerying ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Querying...
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4" />
                Apply Filters & Generate KPI
              </>
            )}
          </Button>

          {queryError && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {queryError}
            </div>
          )}

          {/* Save Button */}
          <Button
            onClick={() => setShowSaveDialog(true)}
            variant="outline"
            className="w-full gap-2"
            size="lg"
            disabled={!hasApplied}
          >
            <Save className="h-4 w-4" />
            Save This KPI
          </Button>
        </div>

        {/* Chart Preview */}
        <ChartPreview
          key={`${metric}-${groupBy}-${JSON.stringify(kpiConfig.filters)}`}
          data={aggregatedData}
          multiSeriesData={[]}
          seriesKeys={[]}
          chartType={chartType}
          isLoading={isQuerying}
          metric={metric}
          config={kpiConfig}
        />
      </div>

      {/* Save Dialog */}
      <SaveKPIDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        config={kpiConfig}
      />
    </div>
  );
}
