import { supabase } from "@/integrations/supabase/client";

// Detection interface matching Supabase schema
export interface Detection {
  id: string;
  class: 'human' | 'vehicle' | 'pallet_truck' | 'agv';
  t: string;
  x: number;
  y: number;
  heading: number;
  area: string;
  vest: 0 | 1;
  speed: number;
  with_object: boolean;
}

// Fetch detections from Supabase
export async function fetchDetections(
  limit: number = 10000
): Promise<Detection[]> {
  try {
    console.log('Fetching detections from Supabase...');
    
    const { data, error } = await supabase
      .from('detections')
      .select('*')
      .order('t', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching detections:', error);
      throw error;
    }

    console.log(`Fetched ${data?.length || 0} detections`);
    
    // Transform to match existing interface (use 'class' field as 'type' for compatibility)
    return (data || []).map(d => ({
      ...d,
      class: d.class as any,
      vest: (d.vest as 0 | 1),
    }));
  } catch (error) {
    console.error('Failed to fetch detections:', error);
    throw error;
  }
}

// Check if data exists in the database
export async function checkDataExists(): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('detections')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error checking data:', error);
      return false;
    }

    return (count || 0) > 0;
  } catch (error) {
    console.error('Failed to check data:', error);
    return false;
  }
}

// Import CSV data
export async function importCSVData(csvUrl: string): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('import-csv', {
      body: { csvUrl },
    });

    if (error) {
      throw error;
    }

    console.log('CSV import result:', data);
  } catch (error) {
    console.error('Failed to import CSV:', error);
    throw error;
  }
}
