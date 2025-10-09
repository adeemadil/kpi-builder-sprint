import * as fs from 'fs';
import * as path from 'path';

interface CSVRow {
  type: string;
  x: number;
  y: number;
  id: string;
  speed: number;
  heading: number;
  area: string;
  vest: number;
  with_object: boolean;
  timestamp: string;
}

async function analyzeCSV() {
  console.log('📊 Analyzing work-package-raw-data.csv...\n');

  const csvPath = path.join(__dirname, '../../data/work-package-raw-data.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());

  // Parse CSV
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows: CSVRow[] = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    return {
      type: values[headers.indexOf('type')],
      x: parseFloat(values[headers.indexOf('x')]),
      y: parseFloat(values[headers.indexOf('y')]),
      id: values[headers.indexOf('id')],
      speed: parseFloat(values[headers.indexOf('speed')]),
      heading: parseFloat(values[headers.indexOf('heading')]),
      area: values[headers.indexOf('area')],
      vest: parseInt(values[headers.indexOf('vest')]),
      with_object: values[headers.indexOf('with_object')] === 'True',
      timestamp: values[headers.indexOf('timestamp')]
    };
  });

  console.log('📈 BASIC STATISTICS:');
  console.log(`Total Records: ${rows.length}`);
  console.log('');

  // Class Distribution
  const classCounts = rows.reduce((acc, row) => {
    acc[row.type] = (acc[row.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('👥 CLASS DISTRIBUTION:');
  Object.entries(classCounts).forEach(([type, count]) => {
    const percentage = ((count / rows.length) * 100).toFixed(2);
    console.log(`  ${type}: ${count} (${percentage}%)`);
  });
  console.log('');

  // Speed Analysis
  const speeds = rows.filter(r => !isNaN(r.speed)).map(r => r.speed);
  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const maxSpeed = Math.max(...speeds);
  const minSpeed = Math.min(...speeds);
  const overspeedCount = speeds.filter(s => s > 1.5).length;

  console.log('🚗 SPEED ANALYSIS:');
  console.log(`  Average Speed: ${avgSpeed.toFixed(2)} m/s`);
  console.log(`  Max Speed: ${maxSpeed.toFixed(2)} m/s`);
  console.log(`  Min Speed: ${minSpeed.toFixed(2)} m/s`);
  console.log(`  Records > 1.5 m/s (overspeed): ${overspeedCount} (${((overspeedCount/speeds.length)*100).toFixed(2)}%)`);
  console.log('');

  // Vest Analysis (humans only)
  const humans = rows.filter(r => r.type === 'human');
  const withVest = humans.filter(r => r.vest === 1).length;
  const withoutVest = humans.filter(r => r.vest === 0).length;

  console.log('👕 VEST ANALYSIS (Humans only):');
  console.log(`  Total Humans: ${humans.length}`);
  console.log(`  With Vest: ${withVest} (${((withVest/humans.length)*100).toFixed(2)}%)`);
  console.log(`  Without Vest (violations): ${withoutVest} (${((withoutVest/humans.length)*100).toFixed(2)}%)`);
  console.log('');

  // Coordinate Ranges
  const xCoords = rows.map(r => r.x);
  const yCoords = rows.map(r => r.y);

  console.log('📍 COORDINATE RANGES:');
  console.log(`  X: ${Math.min(...xCoords).toFixed(2)} to ${Math.max(...xCoords).toFixed(2)}`);
  console.log(`  Y: ${Math.min(...yCoords).toFixed(2)} to ${Math.max(...yCoords).toFixed(2)}`);
  console.log('');

  // Time Range
  const timestamps = rows.map(r => new Date(r.timestamp));
  const minDate = new Date(Math.min(...timestamps.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...timestamps.map(d => d.getTime())));

  console.log('⏰ TIME RANGE:');
  console.log(`  From: ${minDate.toISOString()}`);
  console.log(`  To: ${maxDate.toISOString()}`);
  console.log(`  Duration: ${((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)).toFixed(1)} days`);
  console.log('');

  // Area Distribution
  const areaCounts = rows.reduce((acc, row) => {
    acc[row.area] = (acc[row.area] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('🏢 AREA DISTRIBUTION:');
  Object.entries(areaCounts).sort((a, b) => b[1] - a[1]).forEach(([area, count]) => {
    const percentage = ((count / rows.length) * 100).toFixed(2);
    console.log(`  Area ${area}: ${count} (${percentage}%)`);
  });
  console.log('');

  // Close Call Potential Analysis
  const humansByTime = rows.filter(r => r.type === 'human')
    .reduce((acc, r) => {
      acc[r.timestamp] = acc[r.timestamp] || [];
      acc[r.timestamp].push(r);
      return acc;
    }, {} as Record<string, CSVRow[]>);

  const vehiclesByTime = rows.filter(r => ['vehicle', 'pallet_truck', 'agv'].includes(r.type))
    .reduce((acc, r) => {
      acc[r.timestamp] = acc[r.timestamp] || [];
      acc[r.timestamp].push(r);
      return acc;
    }, {} as Record<string, CSVRow[]>);

  let potentialCloseCalls = 0;
  Object.keys(humansByTime).forEach(time => {
    if (vehiclesByTime[time]) {
      humansByTime[time].forEach(human => {
        vehiclesByTime[time].forEach(vehicle => {
          const distance = Math.sqrt(
            Math.pow(human.x - vehicle.x, 2) +
            Math.pow(human.y - vehicle.y, 2)
          );
          if (distance < 2.0) {
            potentialCloseCalls++;
          }
        });
      });
    }
  });

  console.log('⚠️  CLOSE CALL ANALYSIS:');
  console.log(`  Potential Close Calls (< 2m): ${potentialCloseCalls}`);
  console.log('');

  // Data Quality Checks
  console.log('✅ DATA QUALITY:');
  const nullSpeeds = rows.filter(r => isNaN(r.speed)).length;
  const nullHeadings = rows.filter(r => isNaN(r.heading)).length;
  const invalidCoords = rows.filter(r => isNaN(r.x) || isNaN(r.y)).length;

  console.log(`  Missing Speed: ${nullSpeeds} (${((nullSpeeds/rows.length)*100).toFixed(2)}%)`);
  console.log(`  Missing Heading: ${nullHeadings} (${((nullHeadings/rows.length)*100).toFixed(2)}%)`);
  console.log(`  Invalid Coordinates: ${invalidCoords}`);
  console.log('');

  // Expected Results Summary
  console.log('📋 EXPECTED API RESULTS:');
  console.log(`  /api/health → recordCount: ${rows.length}`);
  console.log(`  /api/vest-violations → should return ~${withoutVest} total violations`);
  console.log(`  /api/overspeed → should return ~${overspeedCount} events`);
  console.log(`  /api/close-calls → should return ~${potentialCloseCalls} incidents`);
  console.log(`  /api/aggregate?metric=count&groupBy=class → should return ${Object.keys(classCounts).length} classes`);
  console.log('');

  console.log('✅ Analysis complete! Use these numbers to validate your API responses.');
}

analyzeCSV().catch(console.error);
