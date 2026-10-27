import type { Budget, Category, CategoryTotal, Transaction } from '../lib/types';

// A small category tree: Home (Rent, Other), Food, and income Salary
export const categories: Category[] = [
  { id: 'home', parent_id: null, kind: 'expense', name: 'Home', slug: 'home', icon: 'House', color: '#f97316', sort_order: 1 },
  { id: 'home-rent', parent_id: 'home', kind: 'expense', name: 'Rent', slug: 'home-rent', icon: 'House', color: '#f97316', sort_order: 1 },
  { id: 'home-other', parent_id: 'home', kind: 'expense', name: 'Other', slug: 'home-other', icon: 'House', color: '#f97316', sort_order: 2 },
  { id: 'food', parent_id: null, kind: 'expense', name: 'Food', slug: 'food', icon: 'UtensilsCrossed', color: '#ef4444', sort_order: 2 },
  { id: 'salary', parent_id: null, kind: 'income', name: 'Salary', slug: 'salary', icon: 'Briefcase', color: '#10b981', sort_order: 1 },
];

let n = 0;
export function txn(over: Partial<Transaction>): Transaction {
  n += 1;
  return {
    id: `t${n}`, type: 'expense', amount: 100, description: `Txn ${n}`, notes: null, occurred_on: '2026-10-10',
    category_id: null, account_id: null, to_account_id: null, investment_id: null,
    created_at: '2026-10-10T10:00:00Z', ...over,
  };
}

export function catTotal(name: string, total: number, count = 1): CategoryTotal {
  return { category_id: name.toLowerCase(), name, icon: 'Tag', color: '#000', total, count };
}

export function budget(over: Partial<Budget>): Budget {
  return { id: 'b', category_id: 'home', amount: 1000, period: 'monthly', sort_order: 0, spent: 0, ...over };
}
