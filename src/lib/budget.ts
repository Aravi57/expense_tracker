import type { Budget, BudgetPeriod } from './types';

// Days left in the budget's current week (Mon–Sun), month or year, counting today
export function daysLeftInPeriod(period: BudgetPeriod, now = new Date()) {
  const end = period === 'weekly'
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - ((now.getDay() + 6) % 7)))
    : period === 'yearly'
      ? new Date(now.getFullYear() + 1, 0, 1)
      : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.max(Math.ceil((end.getTime() - now.getTime()) / 86_400_000), 1);
}

export interface BudgetGroup {
  /** The main (top-level) category these budgets belong to */
  rootId: string;
  /** A budget set on the main category itself, if any */
  main: Budget | undefined;
  /** Budgets set on its subcategories */
  subs: Budget[];
  /** All of them: the main budget first, then the subcategories */
  budgets: Budget[];
  /** What the group's card shows; null when the budgets reset on different schedules */
  total: { amount: number; spent: number; period: BudgetPeriod } | null;
}

// Gather budgets under their main category, keeping the order the user chose.
// A main-category budget already counts its subcategories' spending, so when one
// exists it is the group's total; otherwise the subcategory budgets are added up.
export function groupBudgets(budgets: Budget[], rootOf: (categoryId: string) => string | undefined): BudgetGroup[] {
  const groups = new Map<string, Budget[]>();
  for (const b of budgets) {
    const key = rootOf(b.category_id) ?? b.category_id;
    const list = groups.get(key);
    if (list) list.push(b);
    else groups.set(key, [b]);
  }

  return [...groups.entries()].map(([rootId, list]) => {
    const mains = list.filter((b) => b.category_id === rootId);
    const main = mains.find((b) => b.period === 'monthly') ?? mains[0];
    const subs = list.filter((b) => b !== main);
    const sameSchedule = subs.every((b) => b.period === subs[0]?.period);
    const total = main
      ? { amount: main.amount, spent: main.spent, period: main.period }
      : sameSchedule && subs.length
        ? { amount: sum(subs, 'amount'), spent: sum(subs, 'spent'), period: subs[0].period }
        : null;
    return { rootId, main, subs, budgets: main ? [main, ...subs] : subs, total };
  });
}

// Monthly totals across all groups, counting each rupee of spending once
export function monthlyOverview(groups: BudgetGroup[]) {
  let amount = 0;
  let spent = 0;
  for (const g of groups) {
    if (g.main?.period === 'monthly') {
      amount += g.main.amount;
      spent += g.main.spent;
    } else {
      const monthly = g.subs.filter((b) => b.period === 'monthly');
      amount += sum(monthly, 'amount');
      spent += sum(monthly, 'spent');
    }
  }
  return { amount, spent };
}

const sum = (list: Budget[], key: 'amount' | 'spent') => list.reduce((s, b) => s + b[key], 0);
