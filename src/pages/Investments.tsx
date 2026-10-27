import clsx from 'clsx';
import { LineChart, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useAccounts } from '../api/accounts';
import { useCategoryIndex } from '../api/categories';
import { useDataMutation } from '../api/client';
import {
  addContribution, deleteContribution, deleteInvestment, saveInvestment, useContributions, useInvestments,
} from '../api/investments';
import { DonutChart, InvestedVsValue } from '../components/charts';
import { useConfirm } from '../components/confirm';
import { PageHeader } from '../components/Layout';
import { Button, Card, EmptyState, Field, Input, Segmented, Select, Sheet, Skeleton, Textarea } from '../components/ui';
import { today } from '../lib/dates';
import { INVESTMENT_TYPES, money, percent, RISKS, shortDate } from '../lib/format';
import type { Investment, InvestmentType, Risk } from '../lib/types';

const TYPE_COLORS: Record<string, string> = {
  stocks: '#6366f1', 'mutual-fund': '#8b5cf6', ppf: '#14b8a6', epf: '#06b6d4', silver: '#94a3b8', gold: '#eab308',
  'real-estate': '#f97316', bonds: '#3b82f6', crypto: '#ec4899', 'fixed-deposit': '#22c55e', other: '#64748b',
};

type SortKey = 'newest' | 'oldest' | 'value' | 'return' | 'name';

const returnOf = (i: Investment) => i.current_value - i.invested_amount;
const rateOf = (i: Investment) => (i.invested_amount ? (returnOf(i) / i.invested_amount) * 100 : 0);

export default function Investments() {
  const { data: investments = [], isLoading } = useInvestments();
  const [sort, setSort] = useState<SortKey>('value');
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<{ investment?: Investment } | null>(null);
  const [toppingUp, setToppingUp] = useState<Investment | null>(null);

  const invested = investments.reduce((s, i) => s + i.invested_amount, 0);
  const value = investments.reduce((s, i) => s + i.current_value, 0);
  const gain = value - invested;
  const best = [...investments].sort((a, b) => rateOf(b) - rateOf(a))[0];

  const list = useMemo(() => {
    const rows = investments.filter((i) => !filter || i.type === filter);
    const by: Record<SortKey, (a: Investment, b: Investment) => number> = {
      newest: (a, b) => b.started_on.localeCompare(a.started_on),
      oldest: (a, b) => a.started_on.localeCompare(b.started_on),
      value: (a, b) => b.current_value - a.current_value,
      return: (a, b) => rateOf(b) - rateOf(a),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...rows].sort(by[sort]);
  }, [investments, sort, filter]);

  const distribution = useMemo(() => {
    const byType = new Map<string, number>();
    for (const i of investments) byType.set(i.type, (byType.get(i.type) ?? 0) + i.current_value);
    return [...byType.entries()].map(([t, v]) => ({ name: INVESTMENT_TYPES[t], value: v, color: TYPE_COLORS[t] })).sort((a, b) => b.value - a.value);
  }, [investments]);

  return (
    <div>
      <PageHeader title="Investments" subtitle="Your portfolio at a glance"
        actions={<Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Add investment</Button>} />

      {isLoading ? <Skeleton className="h-40" /> : investments.length === 0 ? (
        <Card>
          <EmptyState icon={<LineChart className="h-6 w-6" />} title="No investments yet"
            text="Record stocks, mutual funds, PPF, gold and more. Update the current value any time to see your returns."
            action={<Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Add your first</Button>} />
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card><p className="text-sm text-muted">Invested</p><p className="text-xl font-bold tabular-nums">{money(invested)}</p></Card>
            <Card><p className="text-sm text-muted">Current value</p><p className="text-xl font-bold tabular-nums">{money(value)}</p></Card>
            <Card>
              <p className="text-sm text-muted">Returns</p>
              <p className={clsx('text-xl font-bold tabular-nums', gain >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]')}>
                {gain >= 0 ? '+' : '−'}{money(Math.abs(gain))}
              </p>
              <p className="text-xs text-muted">{percent(invested ? (gain / invested) * 100 : 0, 1)} overall</p>
            </Card>
            <Card>
              <p className="text-sm text-muted">Best performer</p>
              <p className="truncate text-xl font-bold">{best?.name ?? '–'}</p>
              {best && <p className="text-xs text-[var(--color-income)]">{percent(rateOf(best), 1)}</p>}
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Holdings <span className="text-muted">({list.length})</span></h2>
            <div className="flex gap-2">
              <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 w-auto text-sm" aria-label="Filter by type">
                <option value="">All types</option>
                {Object.entries(INVESTMENT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-9 w-auto text-sm" aria-label="Sort">
                <option value="value">Highest value</option>
                <option value="return">Best return</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name">Name</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((i) => {
              const r = returnOf(i);
              return (
                <Card key={i.id}>
                  <button className="w-full text-left" onClick={() => setEditing({ investment: i })}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{i.name}</p>
                        <p className="text-xs text-muted">{INVESTMENT_TYPES[i.type]} · {RISKS[i.risk]} · since {shortDate(i.started_on)}</p>
                      </div>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: TYPE_COLORS[i.type] }} />
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-bold tabular-nums">{money(i.current_value)}</p>
                        <p className="text-xs text-muted">Invested {money(i.invested_amount)}</p>
                      </div>
                      <span className={clsx('flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
                        r >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400')}>
                        {r >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {percent(rateOf(i), 1)}
                      </span>
                    </div>
                  </button>
                  <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => setToppingUp(i)}>
                    <Plus className="h-4 w-4" /> Top up
                  </Button>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Where your money is">
              <DonutChart data={distribution} />
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {distribution.map((d) => (
                  <li key={d.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="flex-1 truncate">{d.name}</span>
                    <span className="tabular-nums text-muted">{percent((d.value / value) * 100)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Invested vs current value">
              <InvestedVsValue data={[...investments].sort((a, b) => b.current_value - a.current_value).slice(0, 8)
                .map((i) => ({ name: i.name, invested: i.invested_amount, value: i.current_value }))} />
            </Card>
          </div>
        </div>
      )}

      {editing && <InvestmentSheet investment={editing.investment} onClose={() => setEditing(null)} />}
      {toppingUp && <TopUpSheet investment={toppingUp} onClose={() => setToppingUp(null)} />}
    </div>
  );
}

function InvestmentSheet({ investment, onClose }: { investment?: Investment; onClose: () => void }) {
  const confirm = useConfirm();
  const [name, setName] = useState(investment?.name ?? '');
  const [type, setType] = useState<InvestmentType>(investment?.type ?? 'mutual-fund');
  const [risk, setRisk] = useState<Risk>(investment?.risk ?? 'medium');
  const [invested, setInvested] = useState(investment ? String(investment.invested_amount) : '');
  const [current, setCurrent] = useState(investment ? String(investment.current_value) : '');
  const [startedOn, setStartedOn] = useState(investment?.started_on ?? today());
  const [notes, setNotes] = useState(investment?.notes ?? '');
  const [error, setError] = useState('');
  const { data: contributions = [] } = useContributions(investment?.id);
  const save = useDataMutation(saveInvestment, { success: investment ? 'Investment updated' : 'Investment added' });
  const remove = useDataMutation(deleteInvestment, { success: 'Investment deleted' });
  const removeTopUp = useDataMutation(deleteContribution, { success: 'Top-up removed' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Give it a name');
    if (!(Number(invested) >= 0) || invested === '') return setError('Enter the amount invested');
    if (!(await save.run({
      id: investment?.id, name, type, risk, invested_amount: Number(invested),
      current_value: current === '' ? Number(invested) : Number(current), started_on: startedOn, notes,
    }))) return;
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={investment ? 'Edit investment' : 'Add investment'}
      footer={
        <div className="flex gap-2">
          {investment && (
            <Button variant="ghost" className="text-rose-600" aria-label="Delete investment" onClick={async () => {
              if (await confirm({ title: `Delete ${investment.name}?`, message: 'Its top-up history is deleted too. Expenses already recorded for top-ups stay in your activity.', confirmLabel: 'Delete', danger: true })) {
                if (!(await remove.run(investment.id))) return;
                onClose();
              }
            }}><Trash2 className="h-4 w-4" /></Button>
          )}
          <Button type="submit" form="investment-form" className="flex-1" loading={save.isPending}>Save</Button>
        </div>
      }>
      <form id="investment-form" onSubmit={submit} className="space-y-4">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HDFC Mid-Cap Fund" maxLength={60} autoFocus={!investment} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as InvestmentType)}>
              {Object.entries(INVESTMENT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Started"><Input type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total invested (₹)"><Input type="number" inputMode="decimal" min="0" step="0.01" value={invested} onChange={(e) => setInvested(e.target.value)} /></Field>
          <Field label="Current value (₹)" hint="Leave empty if unchanged"><Input type="number" inputMode="decimal" min="0" step="0.01" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Risk</span>
          <Segmented value={risk} onChange={setRisk} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
        </div>
        <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} /></Field>
        {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}

        {contributions.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium">Top-up history</p>
            <ul className="divide-y divide-[var(--border)] rounded-xl border border-app">
              {contributions.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="flex-1">{shortDate(c.contributed_on)}{c.notes && <span className="text-muted"> · {c.notes}</span>}</span>
                  <span className="tabular-nums">{money(c.amount)}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove top-up" onClick={() => removeTopUp.mutate(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Sheet>
  );
}

function TopUpSheet({ investment, onClose }: { investment: Investment; onClose: () => void }) {
  const { data: accounts = [] } = useAccounts();
  const idx = useCategoryIndex();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [record, setRecord] = useState(true);
  const [accountId, setAccountId] = useState(accounts.find((a) => !a.archived)?.id ?? '');
  const [error, setError] = useState('');
  const add = useDataMutation(addContribution, { success: 'Top-up added' });
  const investmentCategory = idx.tree('expense').find((c) => c.slug === 'investment');
  const value = Number(amount) || 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!(value > 0)) return setError('Enter an amount greater than 0');
    if (!(await add.run({
      investment, amount: value, contributed_on: date, notes,
      expense: record ? { account_id: accountId || null, category_id: investmentCategory?.id ?? null } : undefined,
    }))) return;
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={`Top up ${investment.name}`}
      footer={<Button type="submit" form="topup-form" className="w-full" loading={add.isPending}>Add top-up</Button>}>
      <form id="topup-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)"><Input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Notes" hint="Optional, e.g. SIP for October"><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={120} /></Field>
        <label className="flex items-center gap-3 rounded-xl border border-app p-3">
          <input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand-600)]" />
          <span className="flex-1 text-sm">Also record as an expense</span>
        </label>
        {record && (
          <Field label="Paid from">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">No account</option>
              {accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        )}
        <div className="surface-2 space-y-1 rounded-xl p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted">Invested now</span><span className="tabular-nums">{money(investment.invested_amount)}</span></div>
          <div className="flex justify-between font-medium"><span>After top-up</span><span className="tabular-nums">{money(investment.invested_amount + value)}</span></div>
        </div>
        {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
      </form>
    </Sheet>
  );
}
