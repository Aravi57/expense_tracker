import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '../lib/supabase';
import type { Recurring } from '../lib/types';
import { today } from '../lib/dates';

export function useRecurring() {
  return useQuery({
    queryKey: ['recurring'],
    queryFn: async () => {
      const rows = unwrap(
        await supabase.from('et_recurring').select('*').order('active', { ascending: false }).order('next_date'),
      ) as Recurring[];
      return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
    },
  });
}

export type RecurringInput = Omit<Recurring, 'id' | 'active'> & { id?: string; active?: boolean };

export async function saveRecurring(r: RecurringInput) {
  const transfer = r.type === 'transfer';
  const row = {
    type: r.type,
    amount: r.amount,
    description: r.description.trim(),
    category_id: transfer ? null : r.category_id,
    account_id: r.account_id,
    to_account_id: transfer ? r.to_account_id : null,
    frequency: r.frequency,
    next_date: r.next_date,
    end_date: r.end_date || null,
    active: r.active ?? true,
  };
  if (r.id) unwrap(await supabase.from('et_recurring').update(row).eq('id', r.id));
  else unwrap(await supabase.from('et_recurring').insert(row));
  // If it's already due, record it right away
  if (row.active && row.next_date <= today()) await processRecurring();
}

export async function setRecurringActive(id: string, active: boolean) {
  unwrap(await supabase.from('et_recurring').update({ active }).eq('id', id));
}

export async function deleteRecurring(id: string) {
  unwrap(await supabase.from('et_recurring').delete().eq('id', id));
}

// Create transactions for every rule that is due; returns how many were created
export async function processRecurring() {
  return Number(unwrap(await supabase.rpc('et_process_recurring', { p_today: today() })));
}
