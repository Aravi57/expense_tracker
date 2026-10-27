import clsx from 'clsx';
import {
  BarChart3, CalendarClock, Home, LineChart, List, MoreHorizontal, PiggyBank, Plus, Settings, Wallet,
} from 'lucide-react';
import { Suspense, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { useRealtime } from '../hooks/useRealtime';
import { useTransactionSheet } from './TransactionSheet';
import { Sheet, Skeleton } from './ui';

const NAV = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/transactions', label: 'Activity', icon: List },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/investments', label: 'Investments', icon: LineChart },
  { to: '/analysis', label: 'Analysis', icon: BarChart3 },
  { to: '/recurring', label: 'Recurring', icon: CalendarClock },
  { to: '/settings', label: 'Settings', icon: Settings },
];

// Phones show the first four in the tab bar; the rest live under "More"
const PRIMARY = NAV.slice(0, 4);
const MORE = NAV.slice(4);

export function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32" />
      <Skeleton className="h-64" />
    </div>
  );
}

export function Layout() {
  const { session, username } = useAuth();
  const openTransaction = useTransactionSheet();
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  useRealtime(session?.user.id);

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-app bg-[var(--surface)] p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white"><Wallet className="h-5 w-5" /></span>
          <span className="text-lg font-bold">Expenses</span>
        </div>
        <button onClick={() => openTransaction()}
          className="mb-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 font-medium text-white shadow-sm shadow-brand-600/30 transition hover:bg-brand-700">
          <Plus className="h-5 w-5" /> Add transaction
        </button>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'text-muted hover:bg-[var(--surface-2)] hover:text-[var(--text)]')}>
              <Icon className="h-5 w-5" /> {label}
            </NavLink>
          ))}
        </nav>
        <p className="px-3 text-xs text-muted">Signed in as <span className="font-medium text-[var(--text)]">{username}</span></p>
      </aside>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pt-8">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Phone: floating add button + tab bar */}
      <button onClick={() => openTransaction()} aria-label="Add transaction"
        className="fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/40 transition active:scale-95 lg:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <Plus className="h-7 w-7" />
      </button>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-app bg-[var(--surface)]/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {PRIMARY.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => clsx('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium',
                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-muted')}>
              <Icon className="h-5 w-5" /> {label}
            </NavLink>
          ))}
          <button onClick={() => setMoreOpen(true)}
            className={clsx('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium',
              MORE.some((m) => pathname.startsWith(m.to)) ? 'text-brand-600 dark:text-brand-400' : 'text-muted')}>
            <MoreHorizontal className="h-5 w-5" /> More
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <nav className="grid gap-1">
          {MORE.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setMoreOpen(false)}
              className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl px-3 py-3 font-medium',
                isActive ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'hover:bg-[var(--surface-2)]')}>
              <Icon className="h-5 w-5" /> {label}
            </NavLink>
          ))}
        </nav>
      </Sheet>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
