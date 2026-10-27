import { ArrowDown, ArrowUp, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { deleteBudget, reorderBudgets, saveBudget, useBudgets } from '../api/budgets';
import { useCategoryIndex } from '../api/categories';
import { useDataMutation } from '../api/client';
import { CategoryIcon } from '../components/CategoryIcon';
import { CategoryPicker } from '../components/CategoryPicker';
import { useConfirm } from '../components/confirm';
import { PageHeader } from '../components/Layout';
import { Button, Card, EmptyState, Field, Input, ProgressBar, Segmented, Sheet, Skeleton } from '../components/ui';
import { daysLeftInPeriod } from '../lib/budget';
import { money, PERIODS } from '../lib/format';
import type { Budget, BudgetPeriod } from '../lib/types';

export default function Budgets() {
  const { data: budgets = [], isLoading } = useBudgets();
  const idx = useCategoryIndex();
  const [editing, setEditing] = useState<{ budget?: Budget } | null>(null);
  const reorder = useDataMutation(reorderBudgets);

  const monthly = budgets.filter((b) => b.period === 'monthly');
  const totalBudget = monthly.reduce((s, b) => s + b.amount, 0);
  const totalSpent = monthly.reduce((s, b) => s + b.spent, 0);
  const over = budgets.filter((b) => b.spent > b.amount);

  const move = (i: number, by: number) => {
    const ids = budgets.map((b) => b.id);
    [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
    reorder.mutate(ids);
  };

  return (
    <div>
      <PageHeader title="Budgets" subtitle="Set limits per category and stay on track"
        actions={<Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> New budget</Button>} />

      {isLoading ? <Skeleton className="h-40" /> : budgets.length === 0 ? (
        <Card>
          <EmptyState icon={<PiggyBank className="h-6 w-6" />} title="No budgets yet"
            text="Pick a category and a monthly limit. Spending in its subcategories counts too."
            action={<Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Create a budget</Button>} />
        </Card>
      ) : (
        <div className="space-y-5">
          {monthly.length > 0 && (
            <Card>
              <div className="grid gap-4 sm:grid-cols-3">
                <div><p className="text-sm text-muted">Monthly budget</p><p className="text-2xl font-bold tabular-nums">{money(totalBudget)}</p></div>
                <div><p className="text-sm text-muted">Spent so far</p><p className="text-2xl font-bold tabular-nums text-[var(--color-expense)]">{money(totalSpent)}</p></div>
                <div>
                  <p className="text-sm text-muted">{totalBudget - totalSpent >= 0 ? 'Left to spend' : 'Over budget by'}</p>
                  <p className="text-2xl font-bold tabular-nums">{money(Math.abs(totalBudget - totalSpent))}</p>
                  {totalBudget > totalSpent && <p className="text-xs text-muted">≈ {money((totalBudget - totalSpent) / daysLeftInPeriod('monthly'))} a day for the rest of the month</p>}
                </div>
              </div>
              <ProgressBar className="mt-4 h-3" value={totalBudget ? (totalSpent / totalBudget) * 100 : 0} />
            </Card>
          )}

          {over.length > 0 && (
            <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              Over budget: {over.map((b) => idx.label(b.category_id)).join(', ')}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {budgets.map((b, i) => {
              const root = idx.root(b.category_id);
              const pct = (b.spent / b.amount) * 100;
              const left = b.amount - b.spent;
              return (
                <Card key={b.id} className="cursor-pointer transition hover:border-brand-500/50">
                  <div className="flex items-start gap-3" onClick={() => setEditing({ budget: b })}>
                    <CategoryIcon icon={root?.icon} color={root?.color} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold">{idx.label(b.category_id)}</p>
                        <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-muted">{PERIODS[b.period]}</span>
                      </div>
                      <p className="mt-0.5 text-sm tabular-nums text-muted">{money(b.spent)} of {money(b.amount)}</p>
                    </div>
                  </div>
                  <ProgressBar className="mt-3" value={pct} />
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className={left < 0 ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-muted'}>
                      {left < 0 ? `${money(-left)} over` : `${money(left)} left · ${daysLeftInPeriod(b.period)} days to go`}
                    </span>
                    <span className="flex">
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Move up" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Move down" disabled={i === budgets.length - 1 || reorder.isPending} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {editing && <BudgetSheet budget={editing.budget} nextOrder={budgets.length} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BudgetSheet({ budget, nextOrder, onClose }: { budget?: Budget; nextOrder: number; onClose: () => void }) {
  const confirm = useConfirm();
  const [categoryId, setCategoryId] = useState<string | null>(budget?.category_id ?? null);
  const [amount, setAmount] = useState(budget ? String(budget.amount) : '');
  const [period, setPeriod] = useState<BudgetPeriod>(budget?.period ?? 'monthly');
  const [error, setError] = useState('');
  const save = useDataMutation(saveBudget, { success: budget ? 'Budget updated' : 'Budget created' });
  const remove = useDataMutation(deleteBudget, { success: 'Budget deleted' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!categoryId) return setError('Choose a category');
    if (!(Number(amount) > 0)) return setError('Enter an amount greater than 0');
    if (!(await save.run({ id: budget?.id, category_id: categoryId, amount: Number(amount), period, sort_order: nextOrder }))) return;
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={budget ? 'Edit budget' : 'New budget'}
      footer={
        <div className="flex gap-2">
          {budget && (
            <Button variant="ghost" className="text-rose-600" aria-label="Delete budget" onClick={async () => {
              if (await confirm({ title: 'Delete this budget?', message: 'Your transactions are not affected.', confirmLabel: 'Delete', danger: true })) {
                if (!(await remove.run(budget.id))) return;
                onClose();
              }
            }}><Trash2 className="h-4 w-4" /></Button>
          )}
          <Button type="submit" form="budget-form" className="flex-1" loading={save.isPending}>Save budget</Button>
        </div>
      }>
      <form id="budget-form" onSubmit={submit} className="space-y-5">
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Category</span>
          <CategoryPicker kind="expense" value={categoryId} onChange={setCategoryId} />
        </div>
        <Field label="Limit (₹)">
          <Input type="number" inputMode="decimal" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" />
        </Field>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Resets</span>
          <Segmented value={period} onChange={setPeriod} options={Object.entries(PERIODS).map(([value, label]) => ({ value: value as BudgetPeriod, label }))} />
        </div>
        {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
      </form>
    </Sheet>
  );
}
