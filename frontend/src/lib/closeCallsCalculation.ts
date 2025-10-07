// Calculate close calls between humans and vehicles
import { UnifiedDetection } from './dataAdapter';

export function calculateCloseCalls(
  data: UnifiedDetection[],
  distanceThreshold: number = 2.0,
  timeWindowMs: number = 250
): { timestamp: string; distance: number; humanId: string; vehicleId: string }[] {
  const closeCalls: { timestamp: string; distance: number; humanId: string; vehicleId: string }[] = [];
  
  // Group by time windows
  const timeWindows = new Map<number, UnifiedDetection[]>();
  
  data.forEach(detection => {
    const timeKey = Math.floor(new Date(detection.timestamp).getTime() / timeWindowMs);
    if (!timeWindows.has(timeKey)) {
      timeWindows.set(timeKey, []);
    }
    timeWindows.get(timeKey)!.push(detection);
  });

  // Find close calls in each time window
  timeWindows.forEach(detections => {
    const humans = detections.filter(d => d.type === 'human');
    const vehicles = detections.filter(d => d.type === 'vehicle' || d.type === 'pallet_truck' || d.type === 'agv');

    humans.forEach(human => {
      vehicles.forEach(vehicle => {
        const distance = Math.sqrt(
          Math.pow(human.x - vehicle.x, 2) + Math.pow(human.y - vehicle.y, 2)
        );

        if (distance < distanceThreshold) {
          closeCalls.push({
            timestamp: human.timestamp,
            distance: Number(distance.toFixed(2)),
            humanId: human.id,
            vehicleId: vehicle.id,
          });
        }
      });
    });
  });

  return closeCalls;
}
