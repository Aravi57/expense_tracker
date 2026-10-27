import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { Layout, PageFallback } from './components/Layout';
import { TransactionSheetProvider } from './components/TransactionSheet';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';

// Each screen is its own file, so the first paint only needs the shell. Home is
// fetched while the sign-in screen shows; the rest once the browser is idle.
const loadDashboard = () => import('./pages/Dashboard');
const loaders = [
  () => import('./pages/Transactions'), () => import('./pages/Budgets'), () => import('./pages/Investments'),
  () => import('./pages/Analysis'), () => import('./pages/Recurring'), () => import('./pages/Settings'),
] as const;
const Dashboard = lazy(loadDashboard);
const Transactions = lazy(loaders[0]);
const Budgets = lazy(loaders[1]);
const Investments = lazy(loaders[2]);
const Analysis = lazy(loaders[3]);
const RecurringPage = lazy(loaders[4]);
const Settings = lazy(loaders[5]);

export function prefetchHome() {
  loadDashboard().catch(() => {});
}

function usePrefetchScreens() {
  useEffect(() => {
    const run = () => loaders.forEach((load) => load().catch(() => {}));
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(run, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(run, 2000);
    return () => clearTimeout(t);
  }, []);
}

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="grid min-h-dvh place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;
  }

  if (!session) return <Login onReady={prefetchHome} />;
  return <SignedInApp />;
}

function SignedInApp() {
  usePrefetchScreens();
  return (
    <HashRouter>
      <TransactionSheetProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="budgets" element={<Budgets />} />
              <Route path="investments" element={<Investments />} />
              <Route path="analysis" element={<Analysis />} />
              <Route path="recurring" element={<RecurringPage />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </TransactionSheetProvider>
    </HashRouter>
  );
}
