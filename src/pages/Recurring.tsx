import clsx from 'clsx';
import { CalendarClock, Pause, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAccounts } from '../api/accounts';
import { useCategoryIndex } from '../api/categories';
import { useDataMutation } from '../api/client';
import { deleteRecurring, processRecurring, saveRecurring, setRecurringActive, useRecurring } from '../api/recurring';
import { CategoryIcon } from '../components/CategoryIcon';
import { CategoryPicker } from '../components/CategoryPicker';
import { useConfirm } from '../components/confirm';
import { PageHeader } from '../components/Layout';
import { Button, Card, EmptyState, Field, Input, Segmented, Select, Sheet, Skeleton } from '../components/ui';
import { today } from '../lib/dates';
import { FREQUENCIES, money, shortDate } from '../lib/format';
import type { Frequency, Recurring, TxnType } from '../lib/types';

// Rough monthly equivalent of a rule, for the overview
const PER_MONTH: Record<Frequency, number> = { daily: 30.4, weekly: 4.35, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

export default function RecurringPage() {
  const { data: rules = [], isLoading } = useRecurring();
  const idx = useCategoryIndex();
  const [editing, setEditing] = useState<{ rule?: Recurring } | null>(null);
  const toggle = useDataMutation((r: Recurring) => setRecurringActive(r.id, !r.active), {
    success: (_, r) => (r.active ? 'Paused' : 'Resumed'),
  });
  const run = useDataMutation(processRecurring, {
    success: (n) => (n ? `Recorded ${n} transaction${n === 1 ? '' : 's'}` : 'Nothing is due yet'),
  });

  const active = rules.filter((r) => r.active);
  const monthlyOut = active.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount * PER_MONTH[r.frequency], 0);
  const monthlyIn = active.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount * PER_MONTH[r.frequency], 0);

  return (
    <div>
      <PageHeader title="Recurring" subtitle="Rent, salary, subscriptions: recorded automatically when due"
        actions={<>
          <Button variant="secondary" onClick={() => run.mutate(undefined)} loading={run.isPending}><RefreshCw className="h-4 w-4" /> Record due now</Button>
          <Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> New</Button>
        </>} />

      {active.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Card><p className="text-sm text-muted">Regular income / month</p><p className="text-xl font-bold tabular-nums text-[var(--color-income)]">{money(monthlyIn)}</p></Card>
          <Card><p className="text-sm text-muted">Regular bills / month</p><p className="text-xl font-bold tabular-nums text-[var(--color-expense)]">{money(monthlyOut)}</p></Card>
        </div>
      )}

      <Card padded={false} className="p-2 sm:p-3">
        {isLoading ? <Skeleton className="m-2 h-24" /> : rules.length === 0 ? (
          <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="No recurring transactions"
            text="Set them up once. Each time one comes due it’s added to your activity the next time you open the app."
            action={<Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Add recurring</Button>} />
        ) : (
          <ul>
            {rules.map((r) => {
              const root = idx.root(r.category_id);
              return (
                <li key={r.id} className={clsx('flex items-center gap-3 rounded-xl px-2 py-2.5', !r.active && 'opacity-55')}>
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEditing({ rule: r })}>
                    <CategoryIcon icon={root?.icon} color={root?.color} transfer={r.type === 'transfer'} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.description}</span>
                      <span className="block truncate text-sm text-muted">
                        {FREQUENCIES[r.frequency]} · {r.active ? `next ${shortDate(r.next_date)}` : 'paused'}
                        {r.end_date && ` · until ${shortDate(r.end_date)}`}
                      </span>
                    </span>
                    <span className={clsx('font-semibold tabular-nums', r.type === 'income' ? 'text-[var(--color-income)]' : r.type === 'expense' ? 'text-[var(--color-expense)]' : 'text-muted')}>
                      {money(r.amount)}
                    </span>
                  </button>
                  <Button variant="ghost" size="icon" aria-label={r.active ? 'Pause' : 'Resume'} onClick={() => toggle.mutate(r)}>
                    {r.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {editing && <RecurringSheet rule={editing.rule} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RecurringSheet({ rule, onClose }: { rule?: Recurring; onClose: () => void }) {
  const confirm = useConfirm();
  const idx = useCategoryIndex();
  const { data: accounts = [] } = useAccounts();
  const [type, setType] = useState<TxnType>(rule?.type ?? 'expense');
  const [amount, setAmount] = useState(rule ? String(rule.amount) : '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(rule?.category_id ?? null);
  const [accountId, setAccountId] = useState(rule?.account_id ?? accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(rule?.to_account_id ?? '');
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? 'monthly');
  const [nextDate, setNextDate] = useState(rule?.next_date ?? today());
  const [endDate, setEndDate] = useState(rule?.end_date ?? '');
  const [error, setError] = useState('');
  const save = useDataMutation(saveRecurring, { success: rule ? 'Recurring updated' : 'Recurring added' });
  const remove = useDataMutation(deleteRecurring, { success: 'Recurring deleted' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!(Number(amount) > 0)) return setError('Enter an amount greater than 0');
    if (!description.trim()) return setError('Give it a name, e.g. Rent');
    if (type === 'transfer' && (!accountId || !toAccountId || accountId === toAccountId)) return setError('Choose two different accounts');
    if (endDate && endDate < nextDate) return setError('The end date is before the first date');
    if (!(await save.run({
      id: rule?.id, type, amount: Number(amount), description, category_id: categoryId,
      account_id: accountId || null, to_account_id: toAccountId || null, frequency,
      next_date: nextDate, end_date: endDate || null, active: rule?.active,
    }))) return;
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={rule ? 'Edit recurring' : 'New recurring'}
      footer={
        <div className="flex gap-2">
          {rule && (
            <Button variant="ghost" className="text-rose-600" aria-label="Delete" onClick={async () => {
              if (await confirm({ title: `Delete "${rule.description}"?`, message: 'Transactions it already recorded are kept.', confirmLabel: 'Delete', danger: true })) {
                if (!(await remove.run(rule.id))) return;
                onClose();
              }
            }}><Trash2 className="h-4 w-4" /></Button>
          )}
          <Button type="submit" form="recurring-form" className="flex-1" loading={save.isPending}>Save</Button>
        </div>
      }>
      <form id="recurring-form" onSubmit={submit} className="space-y-4">
        <Segmented value={type} onChange={(t) => { setType(t); if (categoryId && idx.byId.get(categoryId)?.kind !== t) setCategoryId(null); }} options={[
          { value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }, { value: 'transfer', label: 'Transfer' },
        ]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Rent" maxLength={80} /></Field>
          <Field label="Amount (₹)"><Input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        </div>
        {type !== 'transfer' && (
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Category</span>
            <CategoryPicker kind={type} value={categoryId} onChange={setCategoryId} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={type === 'transfer' ? 'From account' : 'Account'}>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">No account</option>
              {accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          {type === 'transfer' ? (
            <Field label="To account">
              <Select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                <option value="">Choose…</option>
                {accounts.filter((a) => !a.archived && a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
          ) : (
            <Field label="Repeats">
              <Select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                {Object.entries(FREQUENCIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
          )}
        </div>
        {type === 'transfer' && (
          <Field label="Repeats">
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              {Object.entries(FREQUENCIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={rule ? 'Next date' : 'First date'}><Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} required /></Field>
          <Field label="End date" hint="Optional"><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
        </div>
        {nextDate <= today() && <p className="text-xs text-muted">The first one is due now and will be recorded as soon as you save.</p>}
        {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
      </form>
    </Sheet>
  );
}
