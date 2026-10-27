import clsx from 'clsx';
import { Repeat } from 'lucide-react';
import { useMemo } from 'react';
import { useAccounts } from '../api/accounts';
import { useCategoryIndex } from '../api/categories';
import { dayLabel, money } from '../lib/format';
import { groupByDay, netOf } from '../lib/transactions';
import type { Transaction } from '../lib/types';
import { CategoryIcon } from './CategoryIcon';
import { useTransactionSheet } from './TransactionSheet';

export function TransactionRow({ t }: { t: Transaction }) {
  const idx = useCategoryIndex();
  const { data: accounts = [] } = useAccounts();
  const open = useTransactionSheet();
  const root = idx.root(t.category_id);
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name;

  const detail = t.type === 'transfer'
    ? `${accountName(t.account_id) ?? '?'} → ${accountName(t.to_account_id) ?? '?'}`
    : [idx.label(t.category_id), accountName(t.account_id)].filter(Boolean).join(' · ');

  return (
    <li>
      <button type="button" onClick={() => open({ transaction: t })}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-[var(--surface-2)]">
        <CategoryIcon icon={root?.icon} color={root?.color} transfer={t.type === 'transfer'} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate font-medium">
            {t.description || 'Untitled'}
            {t.recurring_id && <Repeat className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Recurring" />}
          </span>
          <span className="block truncate text-sm text-muted">{detail}</span>
        </span>
        <span className={clsx('shrink-0 font-semibold tabular-nums',
          t.type === 'income' && 'text-[var(--color-income)]',
          t.type === 'expense' && 'text-[var(--color-expense)]',
          t.type === 'transfer' && 'text-muted')}>
          {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}{money(t.amount, { exact: t.amount % 1 !== 0 })}
        </span>
      </button>
    </li>
  );
}

// Transactions grouped under day headings, each with that day's net total
export function GroupedTransactions({ transactions }: { transactions: Transaction[] }) {
  const groups = useMemo(() => groupByDay(transactions), [transactions]);

  return (
    <div className="space-y-4">
      {groups.map(([day, items]) => {
        const net = netOf(items);
        return (
          <section key={day}>
            <header className="flex items-center justify-between px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              <span>{dayLabel(day)}</span>
              <span className="tabular-nums">{net > 0 ? '+' : net < 0 ? '−' : ''}{money(Math.abs(net))}</span>
            </header>
            <ul>{items.map((t) => <TransactionRow key={t.id} t={t} />)}</ul>
          </section>
        );
      })}
    </div>
  );
}
