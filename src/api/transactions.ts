import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '../lib/supabase';
import type { Transaction, TransactionInput, TxnType } from '../lib/types';
import type { Range } from '../lib/dates';

const PAGE_SIZE = 100;

export interface TxnFilters {
  range: Range | null; // null = all time
  type?: TxnType | '';
  categoryIds?: string[];
  accountId?: string;
  search?: string;
}

function normalise(rows: Transaction[]) {
  return rows.map((t) => ({ ...t, amount: Number(t.amount) }));
}

function buildQuery(f: TxnFilters) {
  let q = supabase
    .from('et_transactions')
    .select('*')
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (f.range) q = q.gte('occurred_on', f.range.from).lte('occurred_on', f.range.to);
  if (f.type) q = q.eq('type', f.type);
  if (f.categoryIds?.length) q = q.in('category_id', f.categoryIds);
  if (f.accountId) q = q.or(`account_id.eq.${f.accountId},to_account_id.eq.${f.accountId}`);
  if (f.search?.trim()) q = q.ilike('description', `%${f.search.trim().replace(/[%_]/g, '\\$&')}%`);
  return q;
}

// Paged list (100 per page) so long histories stay fast
export function useTransactions(f: TxnFilters) {
  return useInfiniteQuery({
    queryKey: ['transactions', f],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      normalise(unwrap(await buildQuery(f).range(pageParam, pageParam + PAGE_SIZE - 1)) as Transaction[]),
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined),
  });
}

// Every matching row, for CSV export
export async function fetchAllTransactions(f: TxnFilters) {
  const all: Transaction[] = [];
  for (let from = 0; ; from += 1000) {
    const page = unwrap(await buildQuery(f).range(from, from + 999)) as Transaction[];
    all.push(...normalise(page));
    if (page.length < 1000) return all;
  }
}

export function useRecentTransactions(limit = 6) {
  return useQuery({
    queryKey: ['transactions', 'recent', limit],
    queryFn: async () =>
      normalise(unwrap(await buildQuery({ range: null }).limit(limit)) as Transaction[]),
  });
}

function toRow(t: TransactionInput) {
  const transfer = t.type === 'transfer';
  return {
    type: t.type,
    amount: t.amount,
    description: t.description.trim(),
    notes: t.notes?.trim() || null,
    occurred_on: t.occurred_on,
    category_id: transfer ? null : t.category_id,
    account_id: t.account_id,
    to_account_id: transfer ? t.to_account_id : null,
    investment_id: t.investment_id ?? null,
  };
}

export async function saveTransaction(t: TransactionInput & { id?: string }) {
  if (t.id) unwrap(await supabase.from('et_transactions').update(toRow(t)).eq('id', t.id));
  else unwrap(await supabase.from('et_transactions').insert(toRow(t)));
}

export async function deleteTransaction(id: string) {
  unwrap(await supabase.from('et_transactions').delete().eq('id', id));
}

// Put a deleted transaction back exactly as it was (for "Undo")
export async function restoreTransaction(t: Transaction) {
  unwrap(await supabase.from('et_transactions').insert({ ...toRow(t), id: t.id, recurring_id: t.recurring_id, created_at: t.created_at }));
}
