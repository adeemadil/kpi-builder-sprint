// Utility function to format timestamps for display in charts
export const formatTimestamp = (timestamp: string, groupBy?: string): string => {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    
    // For hourly grouping, show just the hour
    if (groupBy === 'hour' || timestamp.includes('T') && timestamp.endsWith('00:00Z')) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        hour12: true 
      });
    }
    
    // For daily grouping, show just the date
    if (groupBy === 'day' || timestamp.includes('T00:00:00Z')) {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    // For minute-level grouping, show time
    if (timestamp.includes('T') && timestamp.includes(':00Z')) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    }
    
    // Default: show the full timestamp
    return timestamp;
  } catch (error) {
    return timestamp;
  }
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
