const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';

interface TimeRange {
  from: string;
  to: string;
}

interface DetectionFilters {
  timeRange?: TimeRange;
  classes?: string[];
  vest?: number;
  speedMin?: number;
  speedMax?: number;
}

interface AggregateRequest {
  metric: 'count' | 'unique_ids' | 'avg_speed';
  filters?: DetectionFilters;
  groupBy: 'hour' | 'day' | 'class';
}

async function fetchJSON(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  
  return response.json();
}

export const api = {
  // Health check
  health: () => fetchJSON('/health'),
  
  // Get detections
  getDetections: (filters?: DetectionFilters, limit = 100, offset = 0) =>
    fetchJSON('/detections', {
      method: 'POST',
      body: JSON.stringify({ filters, limit, offset }),
    }),
  
  // Aggregate data
  aggregate: (request: AggregateRequest) =>
    fetchJSON('/aggregate', {
      method: 'POST',
      body: JSON.stringify(request),
    }),
  
  // Close calls
  closeCalls: (filters: { timeRange: TimeRange }, distance = 2.0) =>
    fetchJSON('/close-calls', {
      method: 'POST',
      body: JSON.stringify({ filters, distance }),
    }),
  
  // Vest violations
  vestViolations: (from: string, to: string) =>
    fetchJSON(`/vest-violations?from=${from}&to=${to}`),
  
  // Overspeed
  overspeed: (from: string, to: string, threshold = 1.5) =>
    fetchJSON(`/overspeed?from=${from}&to=${to}&threshold=${threshold}`),
};


