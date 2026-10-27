import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, CalendarClock, ChevronRight, CreditCard, List, PiggyBank, Plus, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAccounts } from '../api/accounts';
import { useBudgets } from '../api/budgets';
import { useCategoryIndex } from '../api/categories';
import { useRecurring } from '../api/recurring';
import { useCategoryTotals, useSummary } from '../api/stats';
import { useRecentTransactions } from '../api/transactions';
import { AccountSheet } from '../components/AccountSheet';
import { CategoryIcon } from '../components/CategoryIcon';
import { PayCardSheet } from '../components/PayCardSheet';
import { available, isCard, owed, utilisation } from '../lib/credit';
import { TransactionRow } from '../components/TransactionList';
import { useTransactionSheet } from '../components/TransactionSheet';
import { Button, Card, EmptyState, ProgressBar, Skeleton, Trend } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { currentMonth, monthRange, previousRange } from '../lib/dates';
import { ACCOUNT_TYPES, change, money, shortDate, FREQUENCIES } from '../lib/format';
import type { Account } from '../lib/types';

const ACCOUNT_GRADIENTS = [
  'from-indigo-500 to-violet-600', 'from-sky-500 to-blue-600', 'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600', 'from-amber-500 to-orange-600', 'from-slate-600 to-slate-800',
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { fullname, username } = useAuth();
  const openTransaction = useTransactionSheet();
  const range = monthRange(currentMonth());
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: month } = useSummary(range);
  const { data: lastMonth } = useSummary(previousRange(range));
  const { data: categories = [] } = useCategoryTotals(range);
  const { data: recent, isLoading: recentLoading } = useRecentTransactions(6);
  const { data: budgets = [] } = useBudgets();
  const { data: recurring = [] } = useRecurring();
  const idx = useCategoryIndex();
  const [accountSheet, setAccountSheet] = useState<{ account?: Account } | null>(null);

  const visibleAccounts = (accounts ?? []).filter((a) => !a.archived);
  const totalBalance = visibleAccounts.reduce((s, a) => s + a.balance, 0);
  const cards = visibleAccounts.filter(isCard);
  const cardDues = cards.reduce((s, a) => s + owed(a), 0);
  const [payingCard, setPayingCard] = useState<Account | null>(null);
  const income = month?.income ?? 0;
  const expense = month?.expense ?? 0;
  const topCategories = categories.slice(0, 5);
  const maxCategory = topCategories[0]?.total ?? 0;
  const busiestBudgets = [...budgets].sort((a, b) => b.spent / b.amount - a.spent / a.amount).slice(0, 3);
  const upcoming = recurring.filter((r) => r.active).slice(0, 3);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted">{greeting()},</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{fullname || username}</h1>
      </header>

      {/* Balance + this month */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-violet-600 to-fuchsia-600 p-5 text-white shadow-lg shadow-brand-600/20 sm:p-6">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <p className="text-sm text-white/75">Total balance</p>
        {accountsLoading ? <Skeleton className="mt-2 h-10 w-48 bg-white/20" /> : (
          <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{money(totalBalance)}</p>
        )}
        <p className="mt-1 text-xs text-white/60">
          Across {visibleAccounts.length} account{visibleAccounts.length === 1 ? '' : 's'}
          {cardDues > 0 && ` · after ${money(cardDues)} owed on cards`}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-white/10 p-3 backdrop-blur">
          <div>
            <p className="flex items-center gap-1 text-xs text-white/70"><ArrowDownRight className="h-3.5 w-3.5" /> Income</p>
            <p className="font-semibold tabular-nums">{money(income)}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-white/70"><ArrowUpRight className="h-3.5 w-3.5" /> Spent</p>
            <p className="font-semibold tabular-nums">{money(expense)}</p>
          </div>
          <div>
            <p className="text-xs text-white/70">Net this month</p>
            <p className="font-semibold tabular-nums">{income - expense >= 0 ? '+' : '−'}{money(Math.abs(income - expense))}</p>
          </div>
        </div>
      </section>

      {/* Accounts */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Accounts</h2>
          <Button variant="ghost" size="sm" onClick={() => setAccountSheet({})}><Plus className="h-4 w-4" /> Add</Button>
        </div>
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {accountsLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-48 shrink-0 rounded-2xl" />)}
          {visibleAccounts.map((a, i) => (
            <button key={a.id} onClick={() => setAccountSheet({ account: a })}
              className={clsx('flex h-28 w-48 shrink-0 snap-start flex-col justify-between rounded-2xl bg-gradient-to-br p-4 text-left text-white shadow-sm transition active:scale-[0.98]', ACCOUNT_GRADIENTS[i % ACCOUNT_GRADIENTS.length])}>
              <span className="flex items-center justify-between text-sm font-medium">
                <span className="truncate">{a.name}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{ACCOUNT_TYPES[a.type]}</span>
              </span>
              {isCard(a) ? (
                <span>
                  <span className="block text-[11px] text-white/75">Owed</span>
                  <span className="block text-xl font-bold leading-tight tabular-nums">{money(owed(a))}</span>
                  {a.credit_limit && <span className="block text-[11px] text-white/75">{money(available(a))} available</span>}
                </span>
              ) : (
                <span className="text-xl font-bold tabular-nums">{money(a.balance)}</span>
              )}
            </button>
          ))}
          {!accountsLoading && (
            <button onClick={() => setAccountSheet({})}
              className="flex h-28 w-40 shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-app text-sm text-muted transition hover:border-brand-500 hover:text-brand-600">
              <Plus className="h-6 w-6" /> Add account
            </button>
          )}
        </div>
      </section>

      {cards.length > 0 && (
        <Card title={<span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Credit cards</span>}
          action={<span className="text-sm tabular-nums text-muted">{money(cardDues)} owed</span>}>
          <ul className="grid gap-4 sm:grid-cols-2">
            {cards.map((c) => {
              const used = utilisation(c);
              return (
                <li key={c.id} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="text-sm tabular-nums">{money(owed(c))}{c.credit_limit && <span className="text-muted"> / {money(c.credit_limit)}</span>}</span>
                  </div>
                  {used !== null && <ProgressBar value={used} />}
                  <div className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span>{used === null ? 'No limit set' : `${money(available(c))} available · ${Math.round(used)}% used`}</span>
                    {owed(c) > 0 && <Button size="sm" variant="secondary" onClick={() => setPayingCard(c)}>Pay bill</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Spending by category */}
        <Card title="Spending this month" action={<Link to="/analysis" className="flex items-center text-sm font-medium text-brand-600 dark:text-brand-400">Analysis <ChevronRight className="h-4 w-4" /></Link>}>
          <div className="mb-4 flex items-end justify-between">
            <p className="text-3xl font-bold tabular-nums">{money(expense)}</p>
            <Trend value={change(expense, lastMonth?.expense ?? 0)} goodWhenUp={false} />
          </div>
          {topCategories.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No spending yet this month.</p>
          ) : (
            <ul className="space-y-3">
              {topCategories.map((c) => (
                <li key={c.category_id ?? 'none'} className="flex items-center gap-3">
                  <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="tabular-nums">{money(c.total)}</span>
                    </div>
                    <div className="surface-2 h-1.5 overflow-hidden rounded-full">
                      <div className="h-full rounded-full" style={{ width: `${(c.total / maxCategory) * 100}%`, backgroundColor: c.color }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent activity */}
        <Card title="Recent activity" action={<Link to="/transactions" className="flex items-center text-sm font-medium text-brand-600 dark:text-brand-400">See all <ChevronRight className="h-4 w-4" /></Link>}>
          {recentLoading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : recent?.length ? (
            <ul className="-mx-2">{recent.map((t) => <TransactionRow key={t.id} t={t} />)}</ul>
          ) : (
            <EmptyState icon={<List className="h-6 w-6" />} title="No transactions yet" text="Add your first expense or income to get started."
              action={<Button onClick={() => openTransaction()}><Plus className="h-4 w-4" /> Add transaction</Button>} />
          )}
        </Card>

        {/* Budgets */}
        <Card title="Budgets" action={<Link to="/budgets" className="flex items-center text-sm font-medium text-brand-600 dark:text-brand-400">Manage <ChevronRight className="h-4 w-4" /></Link>}>
          {busiestBudgets.length === 0 ? (
            <EmptyState icon={<PiggyBank className="h-6 w-6" />} title="No budgets yet" text="Set a monthly limit for a category and track it here."
              action={<Link to="/budgets"><Button variant="secondary">Set a budget</Button></Link>} />
          ) : (
            <ul className="space-y-4">
              {busiestBudgets.map((b) => {
                const pct = (b.spent / b.amount) * 100;
                return (
                  <li key={b.id}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-medium">{idx.label(b.category_id)}</span>
                      <span className="tabular-nums text-muted">{money(b.spent)} / {money(b.amount)}</span>
                    </div>
                    <ProgressBar value={pct} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Upcoming recurring */}
        <Card title="Upcoming" action={<Link to="/recurring" className="flex items-center text-sm font-medium text-brand-600 dark:text-brand-400">Recurring <ChevronRight className="h-4 w-4" /></Link>}>
          {upcoming.length === 0 ? (
            <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="Nothing scheduled" text="Add rent, salary or subscriptions once and they’ll be recorded automatically."
              action={<Link to="/recurring"><Button variant="secondary">Add recurring</Button></Link>} />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((r) => {
                const root = idx.root(r.category_id);
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                    <CategoryIcon icon={root?.icon} color={root?.color} transfer={r.type === 'transfer'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.description}</p>
                      <p className="text-xs text-muted">{FREQUENCIES[r.frequency]} · next {shortDate(r.next_date)}</p>
                    </div>
                    <span className={clsx('font-semibold tabular-nums', r.type === 'income' ? 'text-[var(--color-income)]' : r.type === 'expense' ? 'text-[var(--color-expense)]' : 'text-muted')}>
                      {money(r.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {accountSheet && <AccountSheet account={accountSheet.account} onClose={() => setAccountSheet(null)} />}
      {payingCard && <PayCardSheet card={payingCard} onClose={() => setPayingCard(null)} />}
      {visibleAccounts.length === 0 && !accountsLoading && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted"><Wallet className="h-4 w-4" /> Add an account to see balances.</p>
      )}
    </div>
  );
}
