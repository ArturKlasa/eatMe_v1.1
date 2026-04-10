import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperatingHoursEditor, OperatingHoursValue } from '@/components/forms/OperatingHoursEditor';

const defaultHours: Record<string, OperatingHoursValue> = {
  monday: { open: '09:00', close: '21:00', closed: false },
  tuesday: { open: '09:00', close: '21:00', closed: false },
  wednesday: { open: '09:00', close: '21:00', closed: false },
  thursday: { open: '09:00', close: '21:00', closed: false },
  friday: { open: '09:00', close: '22:00', closed: false },
  saturday: { open: '09:00', close: '22:00', closed: false },
  sunday: { open: '10:00', close: '20:00', closed: false },
};

describe('OperatingHoursEditor', () => {
  it('renders all 7 days', () => {
    render(<OperatingHoursEditor value={defaultHours} onChange={() => {}} />);
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Tuesday')).toBeInTheDocument();
    expect(screen.getByText('Wednesday')).toBeInTheDocument();
    expect(screen.getByText('Thursday')).toBeInTheDocument();
    expect(screen.getByText('Friday')).toBeInTheDocument();
    expect(screen.getByText('Saturday')).toBeInTheDocument();
    expect(screen.getByText('Sunday')).toBeInTheDocument();
  });

  it('toggling closed disables time inputs', async () => {
    const hours = {
      ...defaultHours,
      monday: { open: '09:00', close: '21:00', closed: true },
    };
    render(<OperatingHoursEditor value={hours} onChange={() => {}} />);
    // Monday is closed — should not have opening/closing time inputs
    expect(screen.queryByLabelText('Opening time for Monday')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Closing time for Monday')).not.toBeInTheDocument();
    // Tuesday is open — should have time inputs
    expect(screen.getByLabelText('Opening time for Tuesday')).toBeInTheDocument();
    expect(screen.getByLabelText('Closing time for Tuesday')).toBeInTheDocument();
  });

  it('quick-fill All days sets all days', async () => {
    const onChange = vi.fn();
    render(<OperatingHoursEditor value={defaultHours} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'All days' }));
    expect(onChange).toHaveBeenCalledOnce();
    const result = onChange.mock.calls[0][0];
    // All 7 days should have the quick-fill values (default 09:00-21:00) and not be closed
    for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
      expect(result[day].open).toBe('09:00');
      expect(result[day].close).toBe('21:00');
      expect(result[day].closed).toBe(false);
    }
  });

  it('quick-fill Weekdays sets only weekdays', async () => {
    const onChange = vi.fn();
    render(<OperatingHoursEditor value={defaultHours} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Weekdays' }));
    expect(onChange).toHaveBeenCalledOnce();
    const result = onChange.mock.calls[0][0];
    for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']) {
      expect(result[day].closed).toBe(false);
    }
    // Weekend should remain unchanged
    expect(result.saturday).toEqual(defaultHours.saturday);
    expect(result.sunday).toEqual(defaultHours.sunday);
  });

  it('quick-fill Weekends sets only weekends', async () => {
    const onChange = vi.fn();
    render(<OperatingHoursEditor value={defaultHours} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Weekends' }));
    expect(onChange).toHaveBeenCalledOnce();
    const result = onChange.mock.calls[0][0];
    expect(result.saturday.closed).toBe(false);
    expect(result.sunday.closed).toBe(false);
    // Weekdays should remain unchanged
    expect(result.monday).toEqual(defaultHours.monday);
  });

  it('onChange fires with correct structure on closed toggle', async () => {
    const onChange = vi.fn();
    render(<OperatingHoursEditor value={defaultHours} onChange={onChange} />);
    // Click the Monday closed checkbox
    const mondayCheckbox = screen.getByLabelText('Closed', { selector: '#closed-monday' });
    await userEvent.click(mondayCheckbox);
    expect(onChange).toHaveBeenCalledOnce();
    const result = onChange.mock.calls[0][0];
    expect(result.monday.closed).toBe(true);
    // Other days unchanged
    expect(result.tuesday.closed).toBe(false);
  });

  it('has aria-labels on time inputs', () => {
    render(<OperatingHoursEditor value={defaultHours} onChange={() => {}} />);
    expect(screen.getByLabelText('Opening time for Monday')).toBeInTheDocument();
    expect(screen.getByLabelText('Closing time for Monday')).toBeInTheDocument();
    expect(screen.getByLabelText('Quick-fill opening time')).toBeInTheDocument();
    expect(screen.getByLabelText('Quick-fill closing time')).toBeInTheDocument();
  });
});
