// Row shapes of the et_* tables (see supabase/migrations)

export type TxnType = 'expense' | 'income' | 'transfer';
export type CategoryKind = 'expense' | 'income';
export type AccountType = 'bank' | 'cash' | 'credit' | 'wallet' | 'investment' | 'other';
export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type Risk = 'low' | 'medium' | 'high';
export type InvestmentType =
  | 'stocks' | 'mutual-fund' | 'ppf' | 'epf' | 'silver' | 'gold'
  | 'real-estate' | 'bonds' | 'crypto' | 'fixed-deposit' | 'other';

export interface Category {
  id: string;
  parent_id: string | null;
  kind: CategoryKind;
  name: string;
  slug: string | null;
  icon: string;
  color: string;
  sort_order: number;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  opening_balance: number;
  /** Credit cards only; null when no limit was set */
  credit_limit: number | null;
  color: string | null;
  sort_order: number;
  archived: boolean;
  /** Negative while money is owed on a credit card */
  balance: number;
}

export interface Transaction {
  id: string;
  type: TxnType;
  amount: number;
  description: string;
  notes: string | null;
  occurred_on: string;
  category_id: string | null;
  account_id: string | null;
  to_account_id: string | null;
  recurring_id: string | null;
  investment_id: string | null;
  created_at: string;
}

export type TransactionInput = Omit<Transaction, 'id' | 'created_at' | 'recurring_id' | 'investment_id'> & {
  investment_id?: string | null;
};

export interface Budget {
  id: string;
  category_id: string;
  amount: number;
  period: BudgetPeriod;
  sort_order: number;
  spent: number;
}

export interface Recurring {
  id: string;
  type: TxnType;
  amount: number;
  description: string;
  category_id: string | null;
  account_id: string | null;
  to_account_id: string | null;
  frequency: Frequency;
  next_date: string;
  end_date: string | null;
  active: boolean;
}

export interface Investment {
  id: string;
  name: string;
  type: InvestmentType;
  risk: Risk;
  invested_amount: number;
  current_value: number;
  started_on: string;
  notes: string | null;
  created_at: string;
}

export interface Contribution {
  id: string;
  investment_id: string;
  amount: number;
  contributed_on: string;
  notes: string | null;
}

export interface Summary {
  income: number;
  expense: number;
  count: number;
  expense_count: number;
  weekend_expense: number;
  largest_expense: number;
}

export interface MonthTotal {
  month: string;
  income: number;
  expense: number;
}

export interface CategoryTotal {
  category_id: string | null;
  name: string;
  icon: string;
  color: string;
  total: number;
  count: number;
}
