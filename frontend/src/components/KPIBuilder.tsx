import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon, Table as TableIcon, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { KPIConfig, MetricType, GroupByType } from '@/lib/kpiCalculations';
import { queryDetections } from '@/lib/dataAdapter';
import { ChartPreview } from './ChartPreview';
import { SaveKPIDialog } from './SaveKPIDialog';

interface KPIBuilderProps {
  onBack: () => void;
  initialConfig?: KPIConfig;
}

// Local API response types to avoid using any

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
  const [timeBucket, setTimeBucket] = useState<'1min' | '5min' | '1hour' | '1day'>(
    (initialConfig?.groupBy === 'time_bucket' ? (initialConfig?.timeBucket as any) : undefined) || '5min'
  );
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar' | 'table'>('line');
  const [isLoading, setIsLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Log chart type changes for debugging
  useEffect(() => {
    console.log('[KPIBuilder] Chart type changed to:', chartType, 'with', aggregatedData.length, 'data points');
  }, [chartType, aggregatedData.length]);

  // Load initial config when it changes
  useEffect(() => {
    if (initialConfig) {
      console.log('[KPIBuilder] ===== LOADING INITIAL CONFIG =====');
      console.log('[KPIBuilder] Received config:', {
        metric: initialConfig.metric,
        groupBy: initialConfig.groupBy,
        timeBucket: initialConfig.timeBucket,
        filters: initialConfig.filters
      });
      
      isLoadingFromConfig.current = true;
      setMetric(initialConfig.metric);
      
      // Set appropriate defaults for specific metrics
      let defaultClasses = initialConfig.filters.classes || [];
      let defaultVest = initialConfig.filters.vest ?? 'all';
      const defaultSpeed = initialConfig.filters.speedMin ?? 1.5;
      
      if (initialConfig.metric === 'vest_violations') {
        // Vest violations should default to human class and vest=0
        if (!defaultClasses.includes('human')) {
          defaultClasses = ['human'];
        }
        defaultVest = 0;
        // Map legacy metric to core metric for UI display
        setMetric('count');
      } else if (initialConfig.metric === 'overspeed') {
        // Map legacy metric to core metric for UI display
        setMetric('count');
      } else if (initialConfig.metric === 'close_calls') {
        // Close calls should have default classes even though not used
        if (defaultClasses.length === 0) {
          defaultClasses = ['human', 'vehicle'];
        }
      }
      
      // Apply the calculated defaults
      setSelectedClasses(defaultClasses);
      setSelectedAreas(initialConfig.filters.areas || []);
      setVestFilter(defaultVest);
      setSpeedThreshold(defaultSpeed);
      setDistanceThreshold(initialConfig.filters.distanceThreshold ?? 2.0);
      setGroupBy(initialConfig.groupBy);
      setTimeBucket(initialConfig.timeBucket || '1hour');
      
      console.log('[KPIBuilder] State SET TO:', {
        metric: initialConfig.metric,
        groupBy: initialConfig.groupBy,
        timeBucket: initialConfig.timeBucket || '1hour'
      });
      
      // Important: mark preset as custom so the preset effect does not overwrite loaded dates
      setTimePreset('custom');
      setCustomTimeRange(initialConfig.filters.timeRange);
      setHasApplied(false); // Reset to allow auto-apply
      // Reset flag after all updates complete
      setTimeout(() => {
        isLoadingFromConfig.current = false;
      }, 0);
    }
    
    // Cleanup function to prevent stale data
    return () => {
      console.log('[KPIBuilder] ===== CLEANUP =====');
      setAggregatedData([]);
      setHasApplied(false);
    };
  }, [initialConfig]);

  // Calculate time range based on preset
  useEffect(() => {
    // Skip when loading from a saved KPI/config or when using a custom preset
    if (isLoadingFromConfig.current || timePreset === 'custom') return;
    
    let from: Date;
    let to: Date;

    switch (timePreset) {
      case 'data-period':
        // Full data period: 15:42:06.435 to 16:00:18.180 on April 2, 2025
        from = new Date('2025-04-02T15:42:06.435Z');
        to = new Date('2025-04-02T16:00:18.200Z');
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
  const handleApplyFilters = useCallback(async () => {
    console.log('[KPIBuilder] ===== APPLY FILTERS CALLED =====');
    console.log('[KPIBuilder] Current state:', {
      metric,
      groupBy,
      timeBucket,
      selectedClasses,
      vestFilter,
      timeRange: customTimeRange
    });
    
    // Skip class validation for close_calls metric (it uses hardcoded human vs vehicle logic)
    if (selectedClasses.length === 0 && metric !== 'close_calls') {
      setQueryError('Please select at least one class');
      return;
    }

    setIsQuerying(true);
    setQueryError(null);

    try {
      // Use dataAdapter to handle all API calls, legacy metric mapping, and groupBy logic
      const transformedData = await queryDetections(kpiConfig);
      
      setAggregatedData(transformedData);
      console.log('[KPIBuilder] Data set:', {
        metric: kpiConfig.metric,
        count: transformedData.length,
        groupBy: kpiConfig.groupBy,
        firstItem: transformedData[0]
      });
      setHasApplied(true);
    } catch (error) {
      console.error('Query failed:', error);
      setQueryError(error instanceof Error ? error.message : 'Failed to query data');
    } finally {
      setIsQuerying(false);
    }
  }, [selectedClasses, kpiConfig, setAggregatedData, setHasApplied, setQueryError, setIsQuerying]);

  // Load initial config data when initialConfig changes
  useEffect(() => {
    if (initialConfig && !hasApplied) {
      // IMMEDIATELY clear old data to prevent stale display
      setAggregatedData([]);
      
      // Mark as applied to prevent duplicate calls
      setHasApplied(true);
      
      // Ensure time range is properly converted to Date objects
      const fromDate = initialConfig.filters.timeRange.from instanceof Date 
        ? initialConfig.filters.timeRange.from 
        : new Date(initialConfig.filters.timeRange.from);
      const toDate = initialConfig.filters.timeRange.to instanceof Date 
        ? initialConfig.filters.timeRange.to 
        : new Date(initialConfig.filters.timeRange.to);
      
      setCustomTimeRange({ from: fromDate, to: toDate });
      
      // Trigger the apply action after state updates
      setTimeout(() => {
        handleApplyFilters();
      }, 150);
    }
  }, [initialConfig, hasApplied]); // Removed handleApplyFilters from deps to prevent loop

  const allClasses = ['human', 'vehicle'];

  // Available areas (from actual data)
  const availableAreas = useMemo(() => {
    return ['1', '2', '3', '4', '5', '7', '8', '9', '11', '12', '13'];
  }, []);

  const toggleClass = (className: string) => {
    setSelectedClasses(prev => {
      const newClasses = prev.includes(className)
        ? prev.filter(c => c !== className)
        : [...prev, className];
      
      // Prevent unchecking the last class
      if (newClasses.length === 0) {
        return prev; // Keep the previous selection
      }
      
      return newClasses;
    });
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
                    <SelectItem value="data-period">Full Data Period (18 min: 15:42-16:00)</SelectItem>
                    <SelectItem value="data-hour">Data Hour (15:00-16:00)</SelectItem>
                    <SelectItem value="data-day">Full Day (April 2, 2025)</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Custom Date Range Inputs */}
                {timePreset === 'custom' && (
                  <div className="space-y-3 p-3 border rounded-md bg-muted/50">
                    <div className="text-sm font-medium text-muted-foreground">Select Custom Date Range</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="from-date" className="text-xs">From Date</Label>
                        <input
                          id="from-date"
                          type="datetime-local"
                          value={customTimeRange.from.toISOString().slice(0, 16)}
                          onChange={(e) => {
                            const newFrom = new Date(e.target.value);
                            setCustomTimeRange(prev => ({ ...prev, from: newFrom }));
                          }}
                          className="w-full px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="to-date" className="text-xs">To Date</Label>
                        <input
                          id="to-date"
                          type="datetime-local"
                          value={customTimeRange.to.toISOString().slice(0, 16)}
                          onChange={(e) => {
                            const newTo = new Date(e.target.value);
                            setCustomTimeRange(prev => ({ ...prev, to: newTo }));
                          }}
                          className="w-full px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Current range: {customTimeRange.from.toLocaleString()} to {customTimeRange.to.toLocaleString()}
                    </div>
                  </div>
                )}
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
                        disabled={selectedClasses.length === 1 && selectedClasses.includes(className)}
                      />
                      <label
                        htmlFor={className}
                        className={`text-sm font-medium leading-none capitalize cursor-pointer ${
                          selectedClasses.length === 1 && selectedClasses.includes(className)
                            ? 'text-muted-foreground'
                            : ''
                        }`}
                      >
                        {className.replace('_', ' ')}
                        {selectedClasses.length === 1 && selectedClasses.includes(className) && (
                          <span className="text-xs text-muted-foreground ml-1">(required)</span>
                        )}
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
              <CardTitle className="text-base">3. Group Results By</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Determines how filtered data is bucketed for visualization
              </p>
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
              
              {/* Add explanation based on selection */}
              {groupBy === 'time_bucket' && (
                <p className="text-xs text-muted-foreground">
                  📊 Groups data by time intervals. Useful for trend analysis.
                </p>
              )}
              {groupBy === 'class' && (
                <p className="text-xs text-muted-foreground">
                  📊 Groups data by asset type (human, vehicle, etc.).
                </p>
              )}
              {groupBy === 'area' && (
                <p className="text-xs text-muted-foreground">
                  📊 Groups data by physical area/zone.
                </p>
              )}
              {groupBy === 'asset_id' && (
                <p className="text-xs text-muted-foreground">
                  📊 Groups data by individual assets (shows top 10).
                </p>
              )}
              {groupBy === 'none' && (
                <p className="text-xs text-muted-foreground">
                  📊 Shows total aggregated value without grouping.
                </p>
              )}

              {groupBy === 'time_bucket' && (
                <Select key={`timebucket-${timeBucket}`} value={timeBucket} onValueChange={(v) => setTimeBucket(v as '1min' | '5min' | '1hour' | '1day')}>
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
          key={`chart-${metric}-${groupBy}-${aggregatedData.length}-${Date.now()}`}
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
