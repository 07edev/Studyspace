import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LineChart, niceTicks } from './LineChart';

const points = [
  { label: '2026-03-01', value: 2 },
  { label: '2026-03-02', value: 0 },
  { label: '2026-03-03', value: 7 },
  { label: '2026-03-04', value: 3 },
];
const chart = () => screen.getByRole('group', { name: /Người dùng mới/ });

describe('niceTicks', () => {
  it('gives whole-number ticks that reach the data with at most four steps', () => {
    expect(niceTicks(0)).toEqual([0, 1, 2, 3, 4]);
    expect(niceTicks(4)).toEqual([0, 1, 2, 3, 4]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(10)).toEqual([0, 5, 10]);
    const big = niceTicks(1234);
    expect(big[0]).toBe(0);
    expect(big.at(-1)!).toBeGreaterThanOrEqual(1234);
    expect(big.length - 1).toBeLessThanOrEqual(4);
    for (const max of [1, 3, 9, 11, 99, 101, 4999, 123456]) {
      const ticks = niceTicks(max);
      expect(ticks.at(-1)!).toBeGreaterThanOrEqual(max);
      expect(ticks.length - 1).toBeLessThanOrEqual(4);
      expect(ticks.every(Number.isInteger)).toBe(true);
    }
  });
});

describe('LineChart', () => {
  it('names the chart, states the total and writes the last value next to the end marker', () => {
    render(<LineChart title="Người dùng mới" unit="người" points={points} />);
    expect(screen.getByText('Người dùng mới')).toBeInTheDocument();
    expect(screen.getByText(/tổng 12 người/)).toBeInTheDocument();
    expect(chart()).toHaveAccessibleName(/4 mốc thời gian, tổng 12 người/);
    expect(chart().querySelector('.viz-end')?.textContent).toBe('3');
    expect(chart().querySelector('.viz-line')).not.toBeNull();
  });

  it('shows no tooltip until the chart is used, then reads the last point on keyboard focus', async () => {
    render(<LineChart title="Người dùng mới" unit="người" points={points} formatLabel={l => l.slice(8)} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await userEvent.tab();
    expect(chart()).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('3 người');
    expect(screen.getByRole('status')).toHaveTextContent('04');
  });

  it('moves between points with the arrow keys, Home and End, and clears on Escape or blur', async () => {
    render(<LineChart title="Người dùng mới" unit="người" points={points} formatLabel={l => l.slice(8)} />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('status')).toHaveTextContent('7 người');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}'); // stops at the first point
    expect(screen.getByRole('status')).toHaveTextContent('2 người');
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('status')).toHaveTextContent('3 người');
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('status')).toHaveTextContent('2 người');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('status')).toBeInTheDocument();
    await userEvent.tab();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('snaps the pointer to the nearest point', () => {
    render(<LineChart title="Người dùng mới" unit="người" points={points} formatLabel={l => l.slice(8)} />);
    const box = chart().parentElement!;
    box.getBoundingClientRect = () => ({ left: 0, top: 0, width: 560, height: 190, right: 560, bottom: 190, x: 0, y: 0, toJSON: () => ({}) });
    // Plot runs from x=40 to x=504 (560 - margins); the third of four points sits at 40 + 2/3 × 464 ≈ 349.
    fireEvent.pointerMove(chart(), { clientX: 355, pointerId: 1 });
    expect(screen.getByRole('status')).toHaveTextContent('7 người');
    fireEvent.pointerMove(chart(), { clientX: 0, pointerId: 1 });
    expect(screen.getByRole('status')).toHaveTextContent('2 người'); // clamped to the first point
    fireEvent.pointerLeave(chart());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('copes with an empty series and a single point', () => {
    const { rerender } = render(<LineChart title="Người dùng mới" unit="người" points={[]} />);
    expect(chart().querySelector('.viz-line')).toBeNull();
    expect(screen.getByText(/tổng 0 người/)).toBeInTheDocument();
    rerender(<LineChart title="Người dùng mới" unit="người" points={[{ label: '2026-03-01', value: 5 }]} />);
    expect(chart().querySelector('.viz-dot')).not.toBeNull();
    expect(chart().querySelector('.viz-end')?.textContent).toBe('5');
  });
});
