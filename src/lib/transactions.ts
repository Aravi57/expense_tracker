import type { Transaction } from './types';

// Group a newest-first list into [day, transactions] pairs, keeping order
export function groupByDay(transactions: Transaction[]): [string, Transaction[]][] {
  const map = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const list = map.get(t.occurred_on);
    if (list) list.push(t);
    else map.set(t.occurred_on, [t]);
  }
  return [...map.entries()];
}

// Income minus expenses; transfers move money between accounts so they don't count
export function netOf(transactions: Transaction[]) {
  return transactions.reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0);
}
