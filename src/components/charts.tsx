import { format, parseISO } from 'date-fns';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { money } from '../lib/format';
import type { MonthTotal } from '../lib/types';

// Chart colours come from the theme's CSS variables so light and dark both read well
const axis = { stroke: 'var(--muted)', fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)' },
  labelStyle: { color: 'var(--muted)' },
  itemStyle: { color: 'var(--text)' },
};
const formatMoney = (v: unknown) => money(Number(v));
const monthTick = (m: string) => format(parseISO(m), 'MMM');

export function DonutChart({ data, height = 240 }: { data: { name: string; value: number; color: string }[]; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2} stroke="none" isAnimationActive={false}>
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={formatMoney} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-xs text-muted">Total</p>
          <p className="text-lg font-bold tabular-nums">{money(total)}</p>
        </div>
      </div>
    </div>
  );
}

export function IncomeExpenseBars({ data, height = 260 }: { data: MonthTotal[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} barGap={2} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" tickFormatter={monthTick} {...axis} />
          <YAxis tickFormatter={(v) => money(v, { compact: true })} width={56} {...axis} />
          <Tooltip {...tooltipStyle} formatter={formatMoney} labelFormatter={(m) => format(parseISO(String(m)), 'MMMM yyyy')} cursor={{ fill: 'var(--surface-2)' }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="income" name="Income" fill="var(--color-income)" radius={[6, 6, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          <Bar dataKey="expense" name="Expenses" fill="var(--color-expense)" radius={[6, 6, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SavingsTrend({ data, height = 220 }: { data: MonthTotal[]; height?: number }) {
  const rows = data.map((m) => ({ month: m.month, savings: m.income - m.expense }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={rows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" tickFormatter={monthTick} {...axis} />
          <YAxis tickFormatter={(v) => money(v, { compact: true })} width={56} {...axis} />
          <Tooltip {...tooltipStyle} formatter={formatMoney} labelFormatter={(m) => format(parseISO(String(m)), 'MMMM yyyy')} />
          <Area type="monotone" dataKey="savings" name="Saved" stroke="#6366f1" strokeWidth={2} fill="url(#savingsFill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function InvestedVsValue({ data, height = 260 }: { data: { name: string; invested: number; value: number }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" {...axis} interval={0} tickFormatter={(n: string) => (n.length > 10 ? `${n.slice(0, 9)}…` : n)} />
          <YAxis tickFormatter={(v) => money(v, { compact: true })} width={56} {...axis} />
          <Tooltip {...tooltipStyle} formatter={formatMoney} cursor={{ fill: 'var(--surface-2)' }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="invested" name="Invested" fill="#94a3b8" radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          <Bar dataKey="value" name="Current value" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
