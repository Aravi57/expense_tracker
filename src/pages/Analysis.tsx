import clsx from 'clsx';
import { AlertTriangle, BarChart3, CheckCircle2, Info, Lightbulb } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useBudgets } from '../api/budgets';
import { useCategoryTotals, useMonthlyTotals, useSummary } from '../api/stats';
import { CategoryIcon } from '../components/CategoryIcon';
import { DonutChart, IncomeExpenseBars, SavingsTrend } from '../components/charts';
import { PageHeader } from '../components/Layout';
import { MonthNav } from '../components/MonthNav';
import { Card, EmptyState, Trend } from '../components/ui';
import { currentMonth, elapsedDays, monthRange, previousRange, today } from '../lib/dates';
import { change, money, percent } from '../lib/format';
import { buildInsights } from '../lib/insights';

export default function Analysis() {
  const [month, setMonth] = useState<string | null>(currentMonth());
  const range = month ? monthRange(month) : null;
  const prev = range ? previousRange(range) : null;

  const { data: s } = useSummary(range);
  const { data: p } = useSummary(prev ?? { from: '1900-01-01', to: '1900-01-01' });
  const { data: categories = [] } = useCategoryTotals(range);
  const { data: prevCategories = [] } = useCategoryTotals(prev ?? { from: '1900-01-01', to: '1900-01-01' });
  const { data: monthly = [] } = useMonthlyTotals(range?.to ?? today(), 12);
  const { data: budgets = [] } = useBudgets();

  const income = s?.income ?? 0;
  const expense = s?.expense ?? 0;
  const savings = income - expense;
  const rate = income ? (savings / income) * 100 : 0;
  const days = range ? elapsedDays(range) : Math.max(monthly.filter((m) => m.income || m.expense).length * 30, 1);
  const daily = expense / days;
  const cmp = (a: number, b: number | undefined) => (prev ? change(a, b ?? 0) : null);
  const prevRate = p?.income ? ((p.income - p.expense) / p.income) * 100 : 0;

  const mostFrequent = [...categories].sort((a, b) => b.count - a.count)[0];
  const weekendShare = expense ? ((s?.weekend_expense ?? 0) / expense) * 100 : 0;

  const insights = useMemo(() => buildInsights({
    income, expense, weekendExpense: s?.weekend_expense ?? 0, categories,
    previousCategories: prev ? prevCategories : null, budgets,
  }), [income, expense, s?.weekend_expense, categories, prev, prevCategories, budgets]);

  const stats = [
    { label: 'Income', value: money(income), trend: cmp(income, p?.income), good: true, cls: 'text-[var(--color-income)]' },
    { label: 'Expenses', value: money(expense), trend: cmp(expense, p?.expense), good: false, cls: 'text-[var(--color-expense)]' },
    { label: 'Net savings', value: `${savings < 0 ? '−' : ''}${money(Math.abs(savings))}`, trend: cmp(savings, p ? p.income - p.expense : 0), good: true },
    { label: 'Savings rate', value: percent(rate), trend: prev && p?.income ? rate - prevRate : null, good: true, points: true },
    { label: 'Avg. daily spend', value: money(daily), trend: null, good: false },
    { label: 'Transactions', value: String(s?.count ?? 0), trend: cmp(s?.count ?? 0, p?.count), good: true, neutral: true },
  ];

  return (
    <div>
      <PageHeader title="Analysis" subtitle="Trends and patterns in your money" actions={<MonthNav month={month} onChange={setMonth} allowAll />} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((st) => (
          <Card key={st.label}>
            <p className="text-sm text-muted">{st.label}</p>
            <p className={clsx('mt-0.5 text-xl font-bold tabular-nums', st.cls)}>{st.value}</p>
            {range && (st.points
              ? st.trend === null ? <span className="text-xs text-muted">No earlier data</span> : <span className="text-xs text-muted">{st.trend >= 0 ? '▲' : '▼'} {Math.abs(st.trend).toFixed(0)} pts vs last month</span>
              : st.neutral ? null : <Trend value={st.trend} goodWhenUp={st.good} />)}
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Income vs expenses" action={<span className="text-xs text-muted">Last 12 months</span>}>
          <IncomeExpenseBars data={monthly} />
        </Card>
        <Card title="Monthly savings" action={<span className="text-xs text-muted">Last 12 months</span>}>
          <SavingsTrend data={monthly} />
        </Card>

        <Card title="Where the money went">
          {categories.length === 0 ? (
            <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="No spending in this period" />
          ) : (
            <>
              <DonutChart data={categories.map((c) => ({ name: c.name, value: c.total, color: c.color }))} />
              <ul className="mt-4 space-y-2.5">
                {categories.map((c) => {
                  const before = prevCategories.find((x) => x.name === c.name)?.total;
                  return (
                    <li key={c.category_id ?? c.name} className="flex items-center gap-3">
                      <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.name}</span>
                        <span className="text-xs text-muted">{c.count} transaction{c.count === 1 ? '' : 's'}{prev && before !== undefined && ` · ${money(before)} last month`}</span>
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-semibold tabular-nums">{money(c.total)}</span>
                        <span className="text-xs text-muted">{percent((c.total / expense) * 100)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Spending patterns">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted">Biggest category</dt>
                <dd className="font-semibold">{categories[0]?.name ?? '–'}</dd>
                <dd className="text-xs text-muted tabular-nums">{categories[0] ? money(categories[0].total) : ''}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Most frequent</dt>
                <dd className="font-semibold">{mostFrequent?.name ?? '–'}</dd>
                <dd className="text-xs text-muted">{mostFrequent ? `${mostFrequent.count} transactions` : ''}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Largest single expense</dt>
                <dd className="font-semibold tabular-nums">{money(s?.largest_expense ?? 0)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Weekend share</dt>
                <dd className="font-semibold">{percent(weekendShare)}</dd>
                <dd className="text-xs text-muted">of spending on Sat–Sun</dd>
              </div>
            </dl>
          </Card>

          <Card title={<span className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-500" /> Insights</span>}>
            {insights.length === 0 ? (
              <p className="text-sm text-muted">Add a few transactions and insights will appear here.</p>
            ) : (
              <ul className="space-y-2.5">
                {insights.map((i) => (
                  <li key={i.text} className="flex gap-2.5 text-sm">
                    {i.tone === 'good' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      : i.tone === 'warn' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        : <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />}
                    <span>{i.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
