import { useState } from 'react';
import { api, type Detection, type SeriesDataPoint } from '@/lib/api';

interface HealthResponse {
  status: string;
  recordCount?: number;
  timestamp?: string;
  [key: string]: unknown;
}

interface DetectionsResponse {
  data: Detection[];
  count?: number;
}

interface AggregateResponse {
  series: SeriesDataPoint[];
  meta?: Record<string, unknown>;
}

export function TestAPI() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [detections, setDetections] = useState<DetectionsResponse | null>(null);
  const [aggregate, setAggregate] = useState<AggregateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testEndpoints = async () => {
    setLoading(true);
    setError(null);
    try {
      const healthData = await api.health();
      setHealth(healthData);

      const detectionsData = await api.getDetections({ classes: ['human'] }, 5);
      setDetections(detectionsData);

      const aggregateData = await api.aggregate({
        metric: 'count',
        filters: { classes: ['human'] },
        groupBy: 'hour',
      });
      setAggregate(aggregateData);

      alert('✅ All API tests passed! Check console for details.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      alert('❌ API test failed: ' + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>API Connection Test</h2>
      <button onClick={testEndpoints} disabled={loading} style={{ padding: '10px 20px', fontSize: '16px' }}>
        {loading ? 'Testing...' : 'Test API Connection'}
      </button>
      {error && <div style={{ color: 'red', marginTop: '20px' }}>Error: {error}</div>}
      {health && (
        <div style={{ marginTop: '20px' }}>
          <h3>Health Check</h3>
          <pre>{JSON.stringify(health, null, 2)}</pre>
        </div>
      )}
      {detections && (
        <div style={{ marginTop: '20px' }}>
          <h3>Sample Detections</h3>
          <pre>{JSON.stringify(detections.data?.slice(0, 2), null, 2)}</pre>
        </div>
      )}
      {aggregate && (
        <div style={{ marginTop: '20px' }}>
          <h3>Aggregate Data</h3>
          <pre>{JSON.stringify(aggregate.series?.slice(0, 3), null, 2)}</pre>
        </div>
      )}
    </div>
  );
}


