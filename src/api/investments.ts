import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '../lib/supabase';
import type { Contribution, Investment } from '../lib/types';

export function useInvestments() {
  return useQuery({
    queryKey: ['investments'],
    queryFn: async () => {
      const rows = unwrap(await supabase.from('et_investments').select('*').order('started_on', { ascending: false })) as Investment[];
      return rows.map((i) => ({ ...i, invested_amount: Number(i.invested_amount), current_value: Number(i.current_value) }));
    },
  });
}

export function useContributions(investmentId: string | undefined) {
  return useQuery({
    queryKey: ['contributions', investmentId],
    enabled: !!investmentId,
    queryFn: async () => {
      const rows = unwrap(
        await supabase
          .from('et_investment_contributions')
          .select('*')
          .eq('investment_id', investmentId!)
          .order('contributed_on', { ascending: false }),
      ) as Contribution[];
      return rows.map((c) => ({ ...c, amount: Number(c.amount) }));
    },
  });
}

export type InvestmentInput = Omit<Investment, 'id' | 'created_at'> & { id?: string };

export async function saveInvestment(i: InvestmentInput) {
  const row = {
    name: i.name.trim(),
    type: i.type,
    risk: i.risk,
    invested_amount: i.invested_amount,
    current_value: i.current_value,
    started_on: i.started_on,
    notes: i.notes?.trim() || null,
  };
  if (i.id) unwrap(await supabase.from('et_investments').update(row).eq('id', i.id));
  else unwrap(await supabase.from('et_investments').insert(row));
}

export async function deleteInvestment(id: string) {
  unwrap(await supabase.from('et_investments').delete().eq('id', id));
}

// A top-up raises the invested amount and current value (a database trigger does
// that). Optionally it is also recorded as an expense from one of the accounts.
export async function addContribution(c: {
  investment: Investment;
  amount: number;
  contributed_on: string;
  notes: string;
  expense?: { account_id: string | null; category_id: string | null };
}) {
  unwrap(
    await supabase.from('et_investment_contributions').insert({
      investment_id: c.investment.id,
      amount: c.amount,
      contributed_on: c.contributed_on,
      notes: c.notes.trim() || null,
    }),
  );
  if (c.expense) {
    unwrap(
      await supabase.from('et_transactions').insert({
        type: 'expense',
        amount: c.amount,
        description: `Top-up: ${c.investment.name}`,
        occurred_on: c.contributed_on,
        account_id: c.expense.account_id,
        category_id: c.expense.category_id,
        investment_id: c.investment.id,
      }),
    );
  }
}

export async function deleteContribution(id: string) {
  unwrap(await supabase.from('et_investment_contributions').delete().eq('id', id));
}
