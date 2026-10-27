import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentMonth, elapsedDays, isCurrentMonth, monthLabel, monthRange, previousRange, shiftMonth, today } from './dates';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 27, 9)); // 27 Oct 2026, local time
});
afterEach(() => vi.useRealTimers());

describe('month helpers', () => {
  it('uses local dates, not UTC', () => {
    // Just after midnight in India is still the previous day in UTC
    vi.setSystemTime(new Date(2026, 9, 28, 0, 30));
    expect(today()).toBe('2026-10-28');
  });

  it('identifies the current month by its first day', () => {
    expect(currentMonth()).toBe('2026-10-01');
    expect(isCurrentMonth('2026-10-01')).toBe(true);
    expect(isCurrentMonth('2026-09-01')).toBe(false);
  });

  it('gives the first and last day of a month, including leap years', () => {
    expect(monthRange('2026-10-01')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2028-02-01')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('gives the previous month across a year boundary', () => {
    expect(previousRange(monthRange('2026-01-01'))).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('moves between months', () => {
    expect(shiftMonth('2026-12-01', 1)).toBe('2027-01-01');
    expect(shiftMonth('2026-03-01', -3)).toBe('2025-12-01');
    expect(monthLabel('2026-10-01')).toBe('October 2026');
  });
});

describe('elapsedDays', () => {
  it('counts days so far in the current month', () => {
    expect(elapsedDays(monthRange('2026-10-01'))).toBe(27);
  });

  it('counts the whole month for past months', () => {
    expect(elapsedDays(monthRange('2026-09-01'))).toBe(30);
  });

  it('is at least 1 for future months', () => {
    expect(elapsedDays(monthRange('2026-12-01'))).toBe(1);
  });
});
