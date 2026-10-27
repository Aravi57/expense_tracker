import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '../lib/supabase';
import type { Budget, BudgetPeriod } from '../lib/types';

// Budgets with spending in their current week / month / year (computed in the database)
export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const rows = unwrap(await supabase.rpc('et_budget_progress')) as Budget[];
      return rows.map((b) => ({ ...b, amount: Number(b.amount), spent: Number(b.spent) }));
    },
  });
}

export async function saveBudget(b: { id?: string; category_id: string; amount: number; period: BudgetPeriod; sort_order?: number }) {
  const row = { category_id: b.category_id, amount: b.amount, period: b.period };
  const { error } = b.id
    ? await supabase.from('et_budgets').update(row).eq('id', b.id)
    : await supabase.from('et_budgets').insert({ ...row, sort_order: b.sort_order ?? 0 });
  if (error?.code === '23505') throw new Error('There is already a budget for that category and period');
  if (error) throw new Error(error.message);
}

export async function deleteBudget(id: string) {
  unwrap(await supabase.from('et_budgets').delete().eq('id', id));
}

// Save a new order (ids in display order)
export async function reorderBudgets(ids: string[]) {
  await Promise.all(ids.map((id, i) => supabase.from('et_budgets').update({ sort_order: i }).eq('id', id).then(unwrap)));
}
