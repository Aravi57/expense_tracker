import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Wallet } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button, Field, Input, Segmented } from '../components/ui';

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p: string) => /[A-Z]/.test(p) && /[a-z]/.test(p), label: 'Upper and lower case letters' },
  { test: (p: string) => /\d/.test(p), label: 'A number' },
];

// `onReady` runs once the screen is up (the app uses it to fetch the Home screen in the background)
export default function Login({ onReady }: { onReady?: () => void }) {
  const { signIn, signUp } = useAuth();
  useEffect(() => { onReady?.(); }, [onReady]);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fullname, setFullname] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup') {
      if (!fullname.trim()) return setError('Please enter your name');
      if (!/^[A-Za-z0-9._-]{4,30}$/.test(username.trim())) return setError('Username: 4–30 letters, numbers, dots, dashes or underscores');
      if (!PASSWORD_RULES.every((r) => r.test(password))) return setError('Your password doesn’t meet the rules below');
      if (password !== confirm) return setError('The passwords don’t match');
    }
    setBusy(true);
    try {
      if (mode === 'login') await signIn(username, password);
      else await signUp(fullname, username, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-violet-600 to-fuchsia-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2 text-xl font-bold"><Wallet className="h-7 w-7" /> Expenses</div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Know where every rupee goes.</h1>
          <p className="mt-4 max-w-md text-lg text-white/80">Spending, budgets, credit cards and investments, in sync on all your devices.</p>
        </div>
        <p className="text-sm text-white/60">Your data is private to your account.</p>
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 text-xl font-bold lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white"><Wallet className="h-5 w-5" /></span>
            Expenses
          </div>
          <h2 className="text-2xl font-bold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="mt-1 text-sm text-muted">{mode === 'login' ? 'Sign in with your username.' : 'No email needed: just a username and password.'}</p>

          <Segmented className="mt-6" value={mode} onChange={(m) => { setMode(m); setError(''); }}
            options={[{ value: 'login', label: 'Sign in' }, { value: 'signup', label: 'Sign up' }]} />

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <Field label="Full name">
                <Input value={fullname} onChange={(e) => setFullname(e.target.value)} autoComplete="name" required />
              </Field>
            )}
            <Field label="Username">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
            </Field>
            <Field label="Password" htmlFor="password">
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required className="pr-11" />
                <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            {mode === 'signup' && (
              <>
                <ul className="space-y-1 text-xs">
                  {PASSWORD_RULES.map((r) => (
                    <li key={r.label} className={r.test(password) ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted'}>
                      {r.test(password) ? '✓' : '○'} {r.label}
                    </li>
                  ))}
                </ul>
                <Field label="Confirm password">
                  <Input type={showPassword ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
                </Field>
              </>
            )}
            {error && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>
          {mode === 'signup' && (
            <p className="mt-4 text-xs text-muted">There’s no email for password resets, so keep your password somewhere safe.</p>
          )}
        </div>
      </div>
    </div>
  );
}
