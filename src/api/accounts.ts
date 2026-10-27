import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '../lib/supabase';
import type { Account } from '../lib/types';

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const rows = unwrap(
        await supabase.from('et_account_balances').select('*').order('sort_order').order('created_at'),
      ) as Account[];
      return rows.map((a) => ({ ...a, balance: Number(a.balance), opening_balance: Number(a.opening_balance) }));
    },
  });
}

export type AccountInput = Pick<Account, 'name' | 'type' | 'opening_balance'> & { id?: string; color?: string | null };

export async function saveAccount(a: AccountInput) {
  const row = { name: a.name.trim(), type: a.type, opening_balance: a.opening_balance, color: a.color ?? null };
  if (a.id) unwrap(await supabase.from('et_accounts').update(row).eq('id', a.id));
  else unwrap(await supabase.from('et_accounts').insert(row));
}

export async function setAccountArchived(id: string, archived: boolean) {
  unwrap(await supabase.from('et_accounts').update({ archived }).eq('id', id));
}

export async function deleteAccount(id: string) {
  unwrap(await supabase.from('et_accounts').delete().eq('id', id));
}
