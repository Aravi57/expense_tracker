import { describe, expect, it, vi } from 'vitest';
import { change, dayLabel, money, percent, shortDate } from './format';

describe('money', () => {
  it('formats rupees with Indian digit grouping and no decimals', () => {
    expect(money(1234567)).toBe('₹12,34,567');
    expect(money(0)).toBe('₹0');
  });

  it('keeps paise when asked for exact amounts', () => {
    expect(money(25.5, { exact: true })).toBe('₹25.50');
  });

  it('accepts numeric strings and nullish values', () => {
    expect(money('75.00')).toBe('₹75');
    expect(money(null)).toBe('₹0');
    expect(money(undefined)).toBe('₹0');
  });

  it('shows negatives with a minus sign', () => {
    expect(money(-500)).toBe('-₹500');
  });

  it('abbreviates large numbers in compact mode', () => {
    expect(money(150000, { compact: true })).toMatch(/₹1\.5\s?L/);
  });
});

describe('percent', () => {
  it('rounds to the requested digits', () => {
    expect(percent(12.345)).toBe('12%');
    expect(percent(12.345, 1)).toBe('12.3%');
  });

  it('shows a dash for impossible values', () => {
    expect(percent(Infinity)).toBe('–');
    expect(percent(NaN)).toBe('–');
  });
});

describe('change', () => {
  it('is the percentage change from previous to current', () => {
    expect(change(150, 100)).toBe(50);
    expect(change(50, 100)).toBe(-50);
  });

  it('is null when there is nothing to compare with', () => {
    expect(change(100, 0)).toBeNull();
  });

  it('measures against the size of a negative previous value', () => {
    expect(change(-50, -100)).toBe(50);
  });
});

describe('dates', () => {
  it('labels today and yesterday by name', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 27, 12));
    expect(dayLabel('2026-10-27')).toBe('Today');
    expect(dayLabel('2026-10-26')).toBe('Yesterday');
    expect(dayLabel('2026-10-20')).toBe('Tue, 20 Oct 2026');
    vi.useRealTimers();
  });

  it('formats short dates', () => {
    expect(shortDate('2026-01-05')).toBe('5 Jan 2026');
  });
});
