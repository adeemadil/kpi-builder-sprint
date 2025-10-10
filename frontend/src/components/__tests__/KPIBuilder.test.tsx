import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KPIBuilder } from '../KPIBuilder';

describe('KPIBuilder', () => {
  it('renders metric selector and presets', async () => {
    render(<KPIBuilder onBack={() => {}} />);

    expect(await screen.findByText('1. Select Metric')).toBeInTheDocument();
    expect(screen.getByText('2. Apply Filters')).toBeInTheDocument();
    expect(screen.getByText('3. Group Results By')).toBeInTheDocument();
  });
});


