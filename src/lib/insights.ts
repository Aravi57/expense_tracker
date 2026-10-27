import { money, percent } from './format';
import type { Budget, CategoryTotal } from './types';

export interface Insight {
  tone: 'good' | 'warn' | 'info';
  text: string;
}

export interface InsightInput {
  income: number;
  expense: number;
  weekendExpense: number;
  categories: CategoryTotal[];
  // Last period's category totals, or null when there's nothing to compare with
  previousCategories: CategoryTotal[] | null;
  budgets: Budget[];
}

// Plain-language observations for the Analysis screen
export function buildInsights({ income, expense, weekendExpense, categories, previousCategories, budgets }: InsightInput): Insight[] {
  const out: Insight[] = [];
  const savings = income - expense;
  const rate = income ? (savings / income) * 100 : 0;

  if (income > 0) {
    if (rate >= 20) out.push({ tone: 'good', text: `You saved ${percent(rate)} of your income. Keep it up.` });
    else if (rate >= 0) out.push({ tone: 'info', text: `You saved ${percent(rate)} of your income. Aiming for 20% builds a cushion faster.` });
    else out.push({ tone: 'warn', text: `You spent ${money(-savings)} more than you earned in this period.` });
  }

  if (previousCategories) {
    const before = new Map(previousCategories.map((c) => [c.name, c.total]));
    for (const c of categories.slice(0, 6)) {
      const prev = before.get(c.name);
      if (prev && c.total > prev * 1.25 && c.total - prev > 500) {
        out.push({ tone: 'warn', text: `${c.name} spending is up ${percent(((c.total - prev) / prev) * 100)} on last month (${money(prev)} → ${money(c.total)}).` });
      }
    }
  }

  if (budgets.length) {
    const over = budgets.filter((b) => b.spent > b.amount);
    out.push(over.length
      ? { tone: 'warn', text: `${over.length} of ${budgets.length} budgets are over their limit right now.` }
      : { tone: 'good', text: `All ${budgets.length} budgets are within their limits right now.` });
  }

  const weekendShare = expense ? (weekendExpense / expense) * 100 : 0;
  if (weekendShare > 45) out.push({ tone: 'info', text: `${percent(weekendShare)} of spending happened at weekends.` });

  if (categories[0] && expense) {
    out.push({ tone: 'info', text: `${categories[0].name} is your biggest expense at ${percent((categories[0].total / expense) * 100)} of spending.` });
  }
  return out;
}
