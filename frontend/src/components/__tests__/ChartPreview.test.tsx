import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ChartPreview } from '../ChartPreview';

describe('ChartPreview', () => {
  const baseProps = {
    data: [
      { label: '2025-04-02T15:00:00Z', value: 10 },
      { label: '2025-04-02T16:00:00Z', value: 20 },
    ],
    multiSeriesData: [],
    seriesKeys: [],
    isLoading: false,
    metric: 'count' as const,
    config: {
      metric: 'count',
      filters: { timeRange: { from: new Date('2025-04-02T15:42:06Z'), to: new Date('2025-04-02T16:00:19Z') }, classes: ['human'] },
      groupBy: 'time_bucket',
      timeBucket: '1hour',
    },
  };

  it('renders table output', () => {
    render(<ChartPreview {...baseProps} chartType="table" />);
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('renders line chart container', () => {
    render(<ChartPreview {...baseProps} chartType="line" />);
    expect(screen.getByText(/count/i)).toBeInTheDocument();
  });
});


