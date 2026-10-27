import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '../lib/supabase';
import type { CategoryTotal, MonthTotal, Summary } from '../lib/types';
import type { Range } from '../lib/dates';

const EMPTY: Summary = { income: 0, expense: 0, count: 0, expense_count: 0, weekend_expense: 0, largest_expense: 0 };
const ALL_TIME: Range = { from: '1900-01-01', to: '2999-12-31' };

export function useSummary(range: Range | null) {
  const r = range ?? ALL_TIME;
  return useQuery({
    queryKey: ['summary', r.from, r.to],
    queryFn: async () => {
      const s = unwrap(await supabase.rpc('et_summary', { p_from: r.from, p_to: r.to })) as Summary | null;
      return Object.fromEntries(Object.entries({ ...EMPTY, ...s }).map(([k, v]) => [k, Number(v)])) as unknown as Summary;
    },
    placeholderData: (prev) => prev,
  });
}

export function useMonthlyTotals(until: string, months = 12) {
  return useQuery({
    queryKey: ['monthly', until, months],
    queryFn: async () => {
      const rows = unwrap(await supabase.rpc('et_monthly_totals', { p_until: until, p_months: months })) as MonthTotal[];
      return rows.map((m) => ({ ...m, income: Number(m.income), expense: Number(m.expense) }));
    },
    placeholderData: (prev) => prev,
  });
}

export function useCategoryTotals(range: Range | null, type: 'expense' | 'income' = 'expense') {
  const r = range ?? ALL_TIME;
  return useQuery({
    queryKey: ['categoryTotals', r.from, r.to, type],
    queryFn: async () => {
      const rows = unwrap(
        await supabase.rpc('et_category_totals', { p_from: r.from, p_to: r.to, p_type: type }),
      ) as CategoryTotal[];
      return rows.map((c) => ({ ...c, total: Number(c.total), count: Number(c.count) }));
    },
    placeholderData: (prev) => prev,
  });
}

export function useBalanceAt(date: string) {
  return useQuery({
    queryKey: ['balanceAt', date],
    queryFn: async () => Number(unwrap(await supabase.rpc('et_balance_at', { p_date: date }))),
  });
}
