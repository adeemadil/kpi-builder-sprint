import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { formatTimestamp, formatTooltipLabel } from '@/lib/dateUtils';

export function Dashboard({ onCreateKPI }: { onCreateKPI: () => void }) {
  const [stats, setStats] = useState({ totalDetections: 0, uniqueAssets: 0, vestViolations: 0 });
  const [classDistribution, setClassDistribution] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load dashboard data on mount
  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        const now = new Date('2025-04-02T16:00:18.200Z'); // End of our data range
        const last24h = new Date('2025-04-02T15:42:06.435Z'); // Start of our data range

        // Query total detections
        const totalResult = await api.aggregate({
          metric: 'count',
          filters: {
            timeRange: { from: last24h.toISOString(), to: now.toISOString() },
            classes: ['human', 'vehicle'],
          },
          groupBy: 'class',
        });

        // Query unique assets
        const uniqueResult = await api.aggregate({
          metric: 'unique_ids',
          filters: {
            timeRange: { from: last24h.toISOString(), to: now.toISOString() },
            classes: ['human', 'vehicle'],
          },
          groupBy: 'class',
        });

        // Query vest violations
        const vestResult = await api.vestViolations(
          last24h.toISOString(),
          now.toISOString()
        );

        // Query class distribution
        const classResult = await api.aggregate({
          metric: 'count',
          filters: {
            timeRange: { from: last24h.toISOString(), to: now.toISOString() },
            classes: ['human', 'vehicle'],
          },
          groupBy: 'class',
        });

        // Query recent activity (last 24h by hour)
        const activityResult = await api.aggregate({
          metric: 'count',
          filters: {
            timeRange: { from: last24h.toISOString(), to: now.toISOString() },
            classes: ['human', 'vehicle'],
          },
          groupBy: 'hour',
        });

        setStats({
          totalDetections: totalResult.series?.reduce((sum: number, item: any) => sum + (item.value || 0), 0) || 0,
          uniqueAssets: uniqueResult.series?.reduce((sum: number, item: any) => sum + (item.value || 0), 0) || 0,
          vestViolations: vestResult.series?.reduce((sum: number, item: any) => sum + (item.value || 0), 0) || 0,
        });

        setClassDistribution(classResult.series?.map((r: any) => ({ name: r.label, value: r.value })) || []);
        setRecentActivity(activityResult.series?.map((r: any) => ({ 
          hour: formatTimestamp(r.time || r.label, 'hour'), 
          count: r.value,
          timestamp: r.time || r.label
        })) || []);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Safety Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor and analyze industrial safety metrics</p>
        </div>
        <button
          onClick={onCreateKPI}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors font-medium shadow-md"
        >
          Create New KPI
        </button>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-none shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 w-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Detections</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDetections.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                April 2, 2025
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Assets</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uniqueAssets}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Being tracked
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Most Active</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">
                {classDistribution[0]?.name || 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Class type
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vest Violations</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.vestViolations}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Safety concerns
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle>Class Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={classDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {classDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle>Activity by Hour (April 2, 2025)</CardTitle>
            <p className="text-sm text-muted-foreground">Data from 15:42:06 to 16:00:18 UTC</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={recentActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" stroke="hsl(var(--foreground))" />
                <YAxis stroke="hsl(var(--foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem'
                  }}
                  labelFormatter={(label) => formatTooltipLabel(recentActivity.find(d => d.hour === label)?.timestamp || label)}
                />
                <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
