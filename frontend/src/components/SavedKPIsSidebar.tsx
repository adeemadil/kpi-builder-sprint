import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Play } from 'lucide-react';
import { KPIConfig } from '@/lib/kpiCalculations';
import { toast } from 'sonner';

interface SavedKPI {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: KPIConfig;
  createdAt: string;
}

interface SavedKPIsSidebarProps {
  onLoadKPI: (config: KPIConfig) => void;
}

// Pre-loaded example KPIs
const exampleKPIs: SavedKPI[] = [
  {
    id: 'example-1',
    name: 'Vest Violations - Last 7 Days',
    description: 'Track safety vest compliance over the past week',
    icon: '⚠️',
    config: {
      metric: 'vest_violations',
      filters: {
        timeRange: {
          from: new Date('2025-04-02T00:00:00.000Z'),
          to: new Date('2025-04-02T23:59:59.999Z'),
        },
        classes: ['human'],
        vest: 0,
      },
      groupBy: 'time_bucket',
      timeBucket: '1day',
    },
    createdAt: new Date('2025-04-02T15:45:00.000Z').toISOString(),
  },
  {
    id: 'example-2',
    name: 'Vehicle Overspeeding Hourly',
    description: 'Monitor vehicles exceeding speed limits',
    icon: '🚨',
    config: {
      metric: 'overspeed',
      filters: {
        timeRange: {
          from: new Date('2025-04-02T00:00:00.000Z'),
          to: new Date('2025-04-02T23:59:59.999Z'),
        },
        classes: ['vehicle'],
        speedMin: 1.5,
      },
      groupBy: 'time_bucket',
      timeBucket: '1hour',
    },
    createdAt: new Date('2025-04-02T15:50:00.000Z').toISOString(),
  },
  {
    id: 'example-3',
    name: 'Close Calls This Week',
    description: 'Human-vehicle near-miss incidents',
    icon: '🚗',
    config: {
      metric: 'close_calls',
      filters: {
        timeRange: {
          from: new Date('2025-04-02T00:00:00.000Z'),
          to: new Date('2025-04-02T23:59:59.999Z'),
        },
        classes: [],
        distanceThreshold: 2.0,
      },
      groupBy: 'time_bucket',
      timeBucket: '1day',
    },
    createdAt: new Date('2025-04-02T15:55:00.000Z').toISOString(),
  },
  {
    id: 'example-4',
    name: 'Human Activity by Hour',
    description: 'Track human presence and activity patterns',
    icon: '👤',
    config: {
      metric: 'count',
      filters: {
        timeRange: {
          from: new Date('2025-04-02T00:00:00.000Z'),
          to: new Date('2025-04-02T23:59:59.999Z'),
        },
        classes: ['human'],
      },
      groupBy: 'time_bucket',
      timeBucket: '1hour',
    },
    createdAt: new Date('2025-04-02T23:59:59.999Z').toISOString(),
  },
];

export function SavedKPIsSidebar({ onLoadKPI }: SavedKPIsSidebarProps) {
  const [savedKPIs, setSavedKPIs] = useState<SavedKPI[]>([]);

  const loadKPIs = () => {
    const stored = JSON.parse(localStorage.getItem('savedKPIs') || '[]');
    // Combine example KPIs with user-saved KPIs
    setSavedKPIs([...exampleKPIs, ...stored]);
  };

  useEffect(() => {
    loadKPIs();

    // Listen for new KPIs being saved
    const handleKPISaved = () => loadKPIs();
    window.addEventListener('kpiSaved', handleKPISaved);
    return () => window.removeEventListener('kpiSaved', handleKPISaved);
  }, []);

  const handleDelete = (id: string) => {
    // Don't allow deleting example KPIs
    if (id.startsWith('example-')) {
      toast.error('Cannot delete example KPIs');
      return;
    }

    const stored = JSON.parse(localStorage.getItem('savedKPIs') || '[]');
    const filtered = stored.filter((kpi: SavedKPI) => kpi.id !== id);
    localStorage.setItem('savedKPIs', JSON.stringify(filtered));
    loadKPIs();
    toast.success('KPI deleted');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date('2025-04-02T23:59:59.999Z');
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="border-none shadow-md h-fit">
      <CardHeader>
        <CardTitle>Saved KPIs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {savedKPIs.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">No saved KPIs yet</p>
            <p className="text-xs mt-1">Create and save your first KPI</p>
          </div>
        ) : (
          savedKPIs.map(kpi => (
            <div
              key={kpi.id}
              className="p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{kpi.icon}</div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{kpi.name}</h4>
                  {kpi.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {kpi.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(kpi.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={() => onLoadKPI(kpi.config)}
                >
                  <Play className="h-3 w-3" />
                  Load
                </Button>
                {!kpi.id.startsWith('example-') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(kpi.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
