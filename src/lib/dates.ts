import { addMonths, endOfMonth, format, startOfMonth, subMonths, differenceInCalendarDays, parseISO } from 'date-fns';

export const iso = (d: Date) => format(d, 'yyyy-MM-dd');
export const today = () => iso(new Date());

export interface Range {
  from: string;
  to: string;
}

// A month is identified by its first day, e.g. '2026-10-01'
export function monthRange(month: string): Range {
  const d = parseISO(month);
  return { from: iso(startOfMonth(d)), to: iso(endOfMonth(d)) };
}

export function previousRange(range: Range): Range {
  const from = parseISO(range.from);
  return { from: iso(startOfMonth(subMonths(from, 1))), to: iso(endOfMonth(subMonths(from, 1))) };
}

export const currentMonth = () => iso(startOfMonth(new Date()));
export const shiftMonth = (month: string, by: number) => iso(addMonths(parseISO(month), by));
export const monthLabel = (month: string) => format(parseISO(month), 'MMMM yyyy');
export const isCurrentMonth = (month: string) => month === currentMonth();

// Days of the range that have passed so far (for daily averages)
export function elapsedDays(range: Range) {
  const end = range.to < today() ? parseISO(range.to) : new Date();
  return Math.max(differenceInCalendarDays(end, parseISO(range.from)) + 1, 1);
}
