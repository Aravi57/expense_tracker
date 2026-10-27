import clsx from 'clsx';
import { ArrowDown, ArrowUp, ChevronDown, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { deleteBudget, reorderBudgets, saveBudget, useBudgets } from '../api/budgets';
import { ensureCategory, useCategoryIndex } from '../api/categories';
import { useDataMutation } from '../api/client';
import { CategoryIcon } from '../components/CategoryIcon';
import { CategoryPicker } from '../components/CategoryPicker';
import { useConfirm } from '../components/confirm';
import { PageHeader } from '../components/Layout';
import { Button, Card, EmptyState, Field, Input, ProgressBar, Segmented, Sheet, Skeleton } from '../components/ui';
import { daysLeftInPeriod, groupBudgets, monthlyOverview } from '../lib/budget';
import { money, PERIODS } from '../lib/format';
import type { Budget, BudgetPeriod } from '../lib/types';

export default function Budgets() {
  const { data: budgets = [], isLoading } = useBudgets();
  const idx = useCategoryIndex();
  const [editing, setEditing] = useState<{ budget?: Budget; categoryId?: string } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const reorder = useDataMutation(reorderBudgets);

  const groups = useMemo(() => groupBudgets(budgets, (id) => idx.root(id)?.id), [budgets, idx]);
  const hasMonthly = budgets.some((b) => b.period === 'monthly');
  const { amount: totalBudget, spent: totalSpent } = monthlyOverview(groups);
  const over = budgets.filter((b) => b.spent > b.amount);

  // Groups move as a whole; their budgets keep their order inside the group
  const move = (i: number, by: number) => {
    const order = [...groups];
    [order[i], order[i + by]] = [order[i + by], order[i]];
    reorder.mutate(order.flatMap((g) => g.budgets.map((b) => b.id)));
  };

  const toggle = (rootId: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(rootId)) next.delete(rootId);
    else next.add(rootId);
    return next;
  });

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
          {hasMonthly && (
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

          <div className="grid items-start gap-3 md:grid-cols-2">
            {groups.map((g, i) => {
              const root = idx.byId.get(g.rootId);
              const single = g.budgets.length === 1 ? g.budgets[0] : null;
              const open = !single && expanded.has(g.rootId);
              const t = g.total;
              const left = t ? t.amount - t.spent : 0;
              return (
                <Card key={g.rootId} className="transition hover:border-brand-500/50">
                  <button type="button" className="flex w-full items-start gap-3 text-left"
                    onClick={() => (single ? setEditing({ budget: single }) : toggle(g.rootId))}
                    aria-expanded={single ? undefined : open}
                    aria-label={single ? `Edit ${idx.label(single.category_id)} budget` : `${root?.name ?? 'Category'} budgets`}>
                    <CategoryIcon icon={root?.icon} color={root?.color} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{single ? idx.label(single.category_id) : root?.name}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {t && <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-muted">{PERIODS[t.period]}</span>}
                          {!single && (
                            <>
                              <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-600 dark:text-brand-400">{g.budgets.length} budgets</span>
                              <ChevronDown className={clsx('h-4 w-4 text-muted transition', open && 'rotate-180')} />
                            </>
                          )}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-sm tabular-nums text-muted">
                        {t ? `${money(t.spent)} of ${money(t.amount)}` : 'Different reset periods: tap to see each'}
                      </span>
                    </span>
                  </button>
                  {t && <ProgressBar className="mt-3" value={(t.spent / t.amount) * 100} />}
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className={left < 0 ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-muted'}>
                      {!t ? '' : left < 0 ? `${money(-left)} over` : `${money(left)} left · ${daysLeftInPeriod(t.period)} days to go`}
                    </span>
                    <span className="flex">
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Move up" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Move down" disabled={i === groups.length - 1 || reorder.isPending} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    </span>
                  </div>

                  {open && (
                    <ul className="mt-3 space-y-1 border-t border-app pt-3">
                      {g.budgets.map((b) => {
                        const c = idx.byId.get(b.category_id);
                        const name = b === g.main ? `All of ${root?.name ?? 'this category'}` : c?.name ?? 'Subcategory';
                        return (
                          <li key={b.id}>
                            <button type="button" onClick={() => setEditing({ budget: b })} aria-label={`Edit ${name} budget`}
                              className="w-full rounded-xl px-2 py-2 text-left transition hover:bg-[var(--surface-2)]">
                              <span className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                                <span className="truncate font-medium">{name}
                                  {t?.period !== b.period && <span className="ml-1.5 text-xs font-normal text-muted">({PERIODS[b.period].toLowerCase()})</span>}
                                </span>
                                <span className={clsx('shrink-0 tabular-nums', b.spent > b.amount ? 'text-rose-600 dark:text-rose-400' : 'text-muted')}>
                                  {money(b.spent)} / {money(b.amount)}
                                </span>
                              </span>
                              <ProgressBar className="h-1.5" value={(b.spent / b.amount) * 100} />
                            </button>
                          </li>
                        );
                      })}
                      <li>
                        <button type="button" onClick={() => setEditing({ categoryId: g.rootId })}
                          className="flex items-center gap-1 px-2 py-1.5 text-sm font-medium text-brand-600 dark:text-brand-400">
                          <Plus className="h-4 w-4" /> Add a budget in {root?.name}
                        </button>
                      </li>
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {editing && <BudgetSheet budget={editing.budget} initialCategory={editing.categoryId} nextOrder={nextOrderFor(editing.categoryId)} onClose={() => setEditing(null)} />}
    </div>
  );

  // A budget added from inside a group goes at the end of that group
  function nextOrderFor(rootId?: string) {
    const g = groups.find((x) => x.rootId === rootId);
    return g ? Math.max(...g.budgets.map((b) => b.sort_order)) : budgets.length;
  }
}

function BudgetSheet({ budget, initialCategory, nextOrder, onClose }: {
  budget?: Budget; initialCategory?: string; nextOrder: number; onClose: () => void;
}) {
  const confirm = useConfirm();
  const idx = useCategoryIndex();
  const [categoryId, setCategoryId] = useState<string | null>(budget?.category_id ?? initialCategory ?? null);
  const [amount, setAmount] = useState(budget ? String(budget.amount) : '');
  const [period, setPeriod] = useState<BudgetPeriod>(budget?.period ?? 'monthly');
  const [customName, setCustomName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = useDataMutation(saveBudget, { success: budget ? 'Budget updated' : 'Budget created' });
  const remove = useDataMutation(deleteBudget, { success: 'Budget deleted' });

  // Picking "Other" (a main category or a subcategory) lets the user name a more specific one instead
  const selected = categoryId ? idx.byId.get(categoryId) : undefined;
  const parent = selected?.parent_id ? idx.byId.get(selected.parent_id) : undefined;
  const isOther = selected?.name === 'Other';
  const namingMain = isOther && !parent;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!categoryId) return setError('Choose a category');
    if (!(Number(amount) > 0)) return setError('Enter an amount greater than 0');
    const name = customName.trim();
    if (isOther && name.toLowerCase() === 'other') return setError('Leave the name empty to use “Other”, or type a different name');

    let target = categoryId;
    if (isOther && name) {
      setBusy(true);
      try {
        target = await ensureCategory(parent ?? null, name, 'expense', idx.all);
      } catch (err) {
        setBusy(false);
        return setError((err as Error).message);
      }
    }
    const ok = await save.run({ id: budget?.id, category_id: target, amount: Number(amount), period, sort_order: nextOrder });
    setBusy(false);
    if (ok) onClose();
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
          <Button type="submit" form="budget-form" className="flex-1" loading={busy || save.isPending}>Save budget</Button>
        </div>
      }>
      <form id="budget-form" onSubmit={submit} className="space-y-5">
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Category</span>
          <CategoryPicker kind="expense" value={categoryId} onChange={setCategoryId} />
        </div>
        {isOther && (
          <Field label={namingMain ? 'Category name' : 'Subcategory name'}
            hint={namingMain
              ? 'Optional. Creates a new main category (also used when adding transactions; set its icon in Settings). Leave empty to keep “Other”.'
              : `Optional. Creates a new subcategory under ${parent!.name} (also used when adding transactions). Leave empty to keep “Other”.`}>
            <Input value={customName} onChange={(e) => setCustomName(e.target.value)} maxLength={40} placeholder={namingMain ? 'e.g. Pets' : 'e.g. Maintenance'} autoFocus />
          </Field>
        )}
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
