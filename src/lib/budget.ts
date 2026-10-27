import type { BudgetPeriod } from './types';

// Days left in the budget's current week (Mon–Sun), month or year, counting today
export function daysLeftInPeriod(period: BudgetPeriod, now = new Date()) {
  const end = period === 'weekly'
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - ((now.getDay() + 6) % 7)))
    : period === 'yearly'
      ? new Date(now.getFullYear() + 1, 0, 1)
      : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.max(Math.ceil((end.getTime() - now.getTime()) / 86_400_000), 1);
}
