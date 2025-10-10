function normalizeApiBase(raw: string): string {
  // Remove trailing slashes
  let base = (raw || '').trim().replace(/\/+$/, '');
  // Ensure it ends with /api
  if (!/\/(api)$/.test(base)) {
    base += '/api';
  }
  return base;
}

const API_BASE = normalizeApiBase((import.meta as ImportMeta).env?.VITE_API_URL || 'http://localhost:3001/api');

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

interface Detection {
  id: string;
  class: string;
  t: string;
  x: number;
  y: number;
  speed?: number;
  heading?: number;
  vest?: number;
}

interface SeriesDataPoint {
  time?: string;
  label?: string;
  value: number;
}

interface AggregateRequest {
  metric: 'count' | 'unique_ids' | 'avg_speed' | 'vest_violations' | 'overspeed';
  filters?: DetectionFilters;
  groupBy: 'hour' | 'day' | 'class' | 'area' | '5min' | '1min';
}

async function fetchJSON(endpoint: string, options?: RequestInit) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // Debug: request
  console.log('🔵 API Call:', {
    url,
    method: options?.method || 'GET',
    // Safely log JSON body if provided
    body: options?.body ? (() => { try { return JSON.parse(options.body as string); } catch { return String(options.body); } })() : null,
  });

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  // Debug: response status
  console.log('📊 Response:', {
    url,
    status: response.status,
    statusText: response.statusText,
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    // Debug: error body
    console.error('❌ API Error:', { url, status: response.status, error: errorText });
    throw new Error(`API Error ${response.status}: ${errorText || response.statusText}`);
  }
  
  const data = await response.json();
  console.log('✅ API Success:', { url, keys: data && typeof data === 'object' ? Object.keys(data) : null });
  return data;
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
export type { Detection, SeriesDataPoint, DetectionFilters, AggregateRequest, TimeRange };
