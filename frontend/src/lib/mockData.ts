// Mock data generator for industrial safety analytics
// Matches the CSV structure: type, x, y, id, speed, heading, area, vest, with_object, timestamp

export interface Detection {
  type: 'human' | 'vehicle' | 'pallet_truck' | 'agv';
  x: number;
  y: number;
  id: string;
  speed: number;
  heading: number;
  area: string;
  vest: 0 | 1;
  with_object: boolean;
  timestamp: string;
}

// Generate realistic mock data
export function generateMockData(count: number = 1500): Detection[] {
  const data: Detection[] = [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Distribution: 60% human, 25% vehicle, 10% pallet_truck, 5% agv
  const classDistribution = [
    { type: 'human' as const, weight: 0.6, idPrefix: 'H', count: 600 },
    { type: 'vehicle' as const, weight: 0.25, idPrefix: 'V', count: 250 },
    { type: 'pallet_truck' as const, weight: 0.1, idPrefix: 'P', count: 100 },
    { type: 'agv' as const, weight: 0.05, idPrefix: 'A', count: 50 },
  ];

  // Generate unique IDs for each class
  const assetIds: Record<string, string[]> = {};
  classDistribution.forEach(({ type, idPrefix, count }) => {
    assetIds[type] = Array.from({ length: count }, (_, i) => 
      `${idPrefix}${String(i + 1).padStart(3, '0')}`
    );
  });

  // Generate detections
  for (let i = 0; i < count; i++) {
    // Pick a random class based on distribution
    const rand = Math.random();
    let cumulativeWeight = 0;
    let selectedClass = classDistribution[0];
    
    for (const classInfo of classDistribution) {
      cumulativeWeight += classInfo.weight;
      if (rand <= cumulativeWeight) {
        selectedClass = classInfo;
        break;
      }
    }

    const type = selectedClass.type;
    const id = assetIds[type][Math.floor(Math.random() * assetIds[type].length)];
    
    // Generate timestamp (more activity during work hours)
    const randomTime = sevenDaysAgo.getTime() + Math.random() * (now.getTime() - sevenDaysAgo.getTime());
    const date = new Date(randomTime);
    const hour = date.getHours();
    
    // Skip some records outside work hours (8am-6pm) to simulate realistic pattern
    if (hour < 8 || hour > 18) {
      if (Math.random() > 0.3) continue; // 70% less activity outside work hours
    }

    // Generate position (warehouse floor 0-100m x 0-150m)
    const x = Math.random() * 100;
    const y = Math.random() * 150;

    // Generate speed (m/s)
    // Humans: 0.3-2.0 m/s (walking/running)
    // Vehicles: 0.5-3.0 m/s
    // Most activity is moderate speed
    let speed: number;
    if (type === 'human') {
      speed = 0.3 + Math.random() * 1.7;
      // 10% are stationary
      if (Math.random() < 0.1) speed = 0;
    } else {
      speed = 0.5 + Math.random() * 2.5;
      // 15% are stationary (parked)
      if (Math.random() < 0.15) speed = 0;
    }

    // 10% of all records are overspeeding (> 1.5 m/s for humans, > 2.5 m/s for vehicles)
    if (Math.random() < 0.1) {
      speed = type === 'human' ? 1.5 + Math.random() * 2.0 : 2.5 + Math.random() * 2.0;
    }

    // Generate heading (0-360 degrees)
    const heading = Math.random() * 360;

    // Generate area (zones 1-12)
    const area = String(Math.floor(Math.random() * 12) + 1);

    // Vest status (only for humans)
    // 15% of humans don't wear vest
    const vest = type === 'human' ? (Math.random() < 0.85 ? 1 : 0) : 0;

    // with_object (some humans/vehicles carry objects)
    const with_object = Math.random() < 0.2;

    data.push({
      type,
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      id,
      speed: Number(speed.toFixed(4)),
      heading: Number(heading.toFixed(4)),
      area,
      vest: vest as 0 | 1,
      with_object,
      timestamp: date.toISOString(),
    });
  }

  // Sort by timestamp
  return data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// Calculate close calls between humans and vehicles
export function calculateCloseCalls(
  data: Detection[],
  distanceThreshold: number = 2.0,
  timeWindowMs: number = 250
): { timestamp: string; distance: number; humanId: string; vehicleId: string }[] {
  const closeCalls: { timestamp: string; distance: number; humanId: string; vehicleId: string }[] = [];
  
  // Group by time windows
  const timeWindows = new Map<number, Detection[]>();
  
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

// Generate the mock data once and cache it
let cachedData: Detection[] | null = null;

export function getMockData(): Detection[] {
  if (!cachedData) {
    cachedData = generateMockData(1500);
  }
  return cachedData;
}
