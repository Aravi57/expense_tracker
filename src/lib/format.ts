import { format, isToday, isYesterday, parseISO } from 'date-fns';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const inrCompact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });

export function money(value: number | string | null | undefined, opts: { exact?: boolean; compact?: boolean } = {}) {
  const n = Number(value ?? 0);
  if (opts.compact) return inrCompact.format(n);
  return (opts.exact ? inrExact : inr).format(n);
}

export function percent(value: number, digits = 0) {
  if (!Number.isFinite(value)) return '–';
  return `${value.toFixed(digits)}%`;
}

// Change from previous to current, as a percentage (null when there's nothing to compare)
export function change(current: number, previous: number) {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function dayLabel(date: string) {
  const d = parseISO(date);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE, d MMM yyyy');
}

export function shortDate(date: string) {
  return format(parseISO(date), 'd MMM yyyy');
}

export const ACCOUNT_TYPES: Record<string, string> = {
  bank: 'Bank account',
  cash: 'Cash',
  credit: 'Credit card',
  wallet: 'Digital wallet',
  investment: 'Investment',
  other: 'Other',
};

export const INVESTMENT_TYPES: Record<string, string> = {
  stocks: 'Stocks',
  'mutual-fund': 'Mutual fund',
  ppf: 'PPF',
  epf: 'EPF',
  silver: 'Silver',
  gold: 'Gold',
  'real-estate': 'Real estate',
  bonds: 'Bonds',
  crypto: 'Crypto',
  'fixed-deposit': 'Fixed deposit',
  other: 'Other',
};

export const FREQUENCIES: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export const PERIODS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export const RISKS: Record<string, string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
};
