// Data adapter for unifying detection data from different sources
export interface UnifiedDetection {
  id: string;
  type: 'human' | 'vehicle' | 'pallet_truck' | 'agv';
  timestamp: string;
  x: number;
  y: number;
  speed: number;
  heading?: number;
  vest?: 0 | 1;
  area: string;
}

// Convert API detection format to unified format
export function adaptDetectionData(apiDetection: any): UnifiedDetection {
  return {
    id: apiDetection.id || '',
    type: apiDetection.class || 'human',
    timestamp: apiDetection.t || apiDetection.timestamp,
    x: apiDetection.x || 0,
    y: apiDetection.y || 0,
    speed: apiDetection.speed || 0,
    heading: apiDetection.heading,
    vest: apiDetection.vest,
    area: apiDetection.area || '1',
  };
}

// Convert array of API detections to unified format
export function adaptDetectionArray(apiDetections: any[]): UnifiedDetection[] {
  return apiDetections.map(adaptDetectionData);
}
