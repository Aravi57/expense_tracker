import { Download, List, Plus, Search, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAccounts } from '../api/accounts';
import { useCategoryIndex } from '../api/categories';
import { useSummary } from '../api/stats';
import { fetchAllTransactions, useTransactions, type TxnFilters } from '../api/transactions';
import { PageHeader } from '../components/Layout';
import { MonthNav } from '../components/MonthNav';
import { GroupedTransactions } from '../components/TransactionList';
import { useTransactionSheet } from '../components/TransactionSheet';
import { Button, Card, EmptyState, Input, Select, Skeleton } from '../components/ui';
import { downloadCsv } from '../lib/csv';
import { currentMonth, monthRange } from '../lib/dates';
import { money } from '../lib/format';
import type { TxnType } from '../lib/types';

export default function Transactions() {
  const openTransaction = useTransactionSheet();
  const idx = useCategoryIndex();
  const { data: accounts = [] } = useAccounts();
  const [month, setMonth] = useState<string | null>(currentMonth());
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TxnType | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  // Search waits for typing to settle so we don't query on every keystroke
  const deferredSearch = useDeferredValue(search);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(deferredSearch), 250);
    return () => clearTimeout(t);
  }, [deferredSearch]);

  const filters: TxnFilters = useMemo(() => ({
    range: month ? monthRange(month) : null,
    type,
    categoryIds: categoryId ? idx.withChildren(categoryId) : undefined,
    accountId: accountId || undefined,
    search: debouncedSearch,
  }), [month, type, categoryId, accountId, debouncedSearch, idx]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useTransactions(filters);
  const { data: summary } = useSummary(filters.range);
  const rows = useMemo(() => data?.pages.flat() ?? [], [data]);
  const filtered = !!(type || categoryId || accountId || debouncedSearch);

  // Totals for what's on screen when filtering; the month summary otherwise
  const totals = useMemo(() => {
    if (!filtered && summary) return { income: summary.income, expense: summary.expense, count: summary.count };
    return rows.reduce((s, t) => ({
      income: s.income + (t.type === 'income' ? t.amount : 0),
      expense: s.expense + (t.type === 'expense' ? t.amount : 0),
      count: s.count + 1,
    }), { income: 0, expense: 0, count: 0 });
  }, [rows, summary, filtered]);

  // Load the next page when the end of the list scrolls into view
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !isFetchingNextPage) fetchNextPage(); }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const exportCsv = async () => {
    const all = await fetchAllTransactions(filters);
    if (!all.length) return toast.info('Nothing to export');
    const name = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '';
    downloadCsv(`transactions_${month ?? 'all'}.csv`,
      ['Date', 'Type', 'Description', 'Category', 'Account', 'To account', 'Amount', 'Notes'],
      all.map((t) => [t.occurred_on, t.type, t.description, t.type === 'transfer' ? '' : idx.label(t.category_id),
        name(t.account_id), name(t.to_account_id), t.amount.toFixed(2), t.notes ?? '']));
    toast.success(`Exported ${all.length} transactions`);
  };

  const clearFilters = () => { setSearch(''); setType(''); setCategoryId(''); setAccountId(''); };
  const categoryOptions = [...idx.tree('expense'), ...idx.tree('income')];

  return (
    <div>
      <PageHeader title="Activity" subtitle="All your income, spending and transfers"
        actions={<>
          <Button variant="secondary" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
          <Button className="hidden lg:inline-flex" onClick={() => openTransaction()}><Plus className="h-4 w-4" /> Add</Button>
        </>} />

      <Card className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MonthNav month={month} onChange={setMonth} allowAll />
          <div className="flex gap-4 text-sm tabular-nums">
            <span><span className="text-muted">In </span><span className="font-semibold text-[var(--color-income)]">{money(totals.income)}</span></span>
            <span><span className="text-muted">Out </span><span className="font-semibold text-[var(--color-expense)]">{money(totals.expense)}</span></span>
            <span className="hidden sm:inline"><span className="text-muted">Count </span><span className="font-semibold">{totals.count}</span></span>
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search descriptions…" className="pl-9" aria-label="Search transactions" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select value={type} onChange={(e) => setType(e.target.value as TxnType | '')} aria-label="Type">
            <option value="">All types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
            <option value="transfer">Transfers</option>
          </Select>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Account">
            <option value="">All accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
        {filtered && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400">
            <X className="h-4 w-4" /> Clear filters
          </button>
        )}
      </Card>

      <Card padded={false} className="p-2 sm:p-3">
        {isLoading ? (
          <div className="space-y-2 p-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<List className="h-6 w-6" />}
            title={filtered ? 'No matching transactions' : 'No transactions this month'}
            text={filtered ? 'Try a different search or clear the filters.' : 'Tap + to add one.'}
            action={filtered ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button> : <Button onClick={() => openTransaction()}><Plus className="h-4 w-4" /> Add transaction</Button>} />
        ) : (
          <>
            <GroupedTransactions transactions={rows} />
            <div ref={sentinel} />
            {isFetchingNextPage && <Skeleton className="m-2 h-14" />}
          </>
        )}
      </Card>
    </div>
  );
}
