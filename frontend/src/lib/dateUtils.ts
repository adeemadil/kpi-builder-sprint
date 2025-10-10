// Utility function to format timestamps for display in charts
export const formatTimestamp = (
  timestamp: string,
  groupBy?: string,
  timeBucket?: '1min' | '5min' | '1hour' | '1day'
): string => {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);

    // If grouping by time buckets, follow the selected bucket explicitly
    if (groupBy === 'time_bucket') {
      if (timeBucket === '1day') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      if (timeBucket === '1hour') {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      }
      // For 1min / 5min buckets show hour:minute
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    // For daily grouping, show just the date (check FIRST to avoid midnight being treated as an hour)
    if (groupBy === 'day' || timestamp.includes('T00:00:00Z')) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }

    // For hourly grouping, show the hour. Detect :00:00Z but not 00:00:00Z (already handled above)
    if (groupBy === 'hour' || /T\d{2}:00:00Z$/.test(timestamp)) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        hour12: true,
      });
    }

    // For minute-level grouping, show time with minutes
    if (timestamp.includes('T')) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    // Default: show the full timestamp
    return timestamp;
  } catch (error) {
    return timestamp;
  }
};

// Helper function to format non-time labels (area, asset_id, etc.)
export const formatLabel = (label: string, groupBy?: string): string => {
  if (!label) return '';
  
  if (groupBy === 'area') {
    return `Area ${label}`;
  } else if (groupBy === 'asset_id') {
    return `Asset ${label}`;
  } else if (groupBy === 'class') {
    return label.charAt(0).toUpperCase() + label.slice(1).replace('_', ' ');
  }
  
  return label;
};

// Function to format tooltip labels
export const formatTooltipLabel = (timestamp: string): string => {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    return timestamp;
  }
};
