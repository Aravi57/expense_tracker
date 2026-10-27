import clsx from 'clsx';
import { ChevronRight, Download, LogOut, Monitor, Moon, Plus, Sun, Tags, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useAccounts } from '../api/accounts';
import { deleteCategory, saveCategory, useCategoryIndex, type CategoryNode } from '../api/categories';
import { useDataMutation } from '../api/client';
import { fetchAllTransactions } from '../api/transactions';
import { CATEGORY_COLORS, CATEGORY_ICONS, CategoryIcon } from '../components/CategoryIcon';
import { useConfirm } from '../components/confirm';
import { PageHeader } from '../components/Layout';
import { Button, Card, Field, Input, Segmented, Sheet } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useTheme, type ThemeChoice } from '../hooks/useTheme';
import { downloadCsv } from '../lib/csv';
import { supabase } from '../lib/supabase';
import { ACCOUNT_TYPES } from '../lib/format';
import { ACCOUNT_ICONS } from '../components/AccountPicker';
import type { AccountType, Category, CategoryKind } from '../lib/types';

export default function Settings() {
  const { username, fullname, signOut, excludedTypes, setExcludedTypes } = useAuth();

  // Tick boxes change instantly; they switch back if saving fails
  const [excluded, setExcluded] = useState(excludedTypes);
  useEffect(() => setExcluded(excludedTypes), [excludedTypes]);
  const toggleType = async (type: AccountType, include: boolean) => {
    const before = excluded;
    const next = include ? excluded.filter((t) => t !== type) : [...excluded, type];
    setExcluded(next);
    try {
      await setExcludedTypes(next);
      toast.success(`${ACCOUNT_TYPES[type]} ${include ? 'now counts' : 'no longer counts'} toward the total balance`);
    } catch (e) {
      setExcluded(before);
      toast.error((e as Error).message);
    }
  };
  const { theme, setTheme } = useTheme();
  const confirm = useConfirm();
  const idx = useCategoryIndex();
  const { data: accounts = [] } = useAccounts();
  const [name, setName] = useState(fullname);
  const [savingName, setSavingName] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [editing, setEditing] = useState<{ category?: Category; parent?: CategoryNode } | null>(null);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    const { error } = await supabase.auth.updateUser({ data: { fullname: name.trim() } });
    setSavingName(false);
    if (error) toast.error(error.message);
    else toast.success('Name updated');
  };

  const exportAll = async () => {
    const all = await fetchAllTransactions({ range: null });
    const acc = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '';
    downloadCsv('expense-tracker-all-transactions.csv',
      ['Date', 'Type', 'Description', 'Category', 'Account', 'To account', 'Amount', 'Notes'],
      all.map((t) => [t.occurred_on, t.type, t.description, t.type === 'transfer' ? '' : idx.label(t.category_id), acc(t.account_id), acc(t.to_account_id), t.amount.toFixed(2), t.notes ?? '']));
    toast.success(`Exported ${all.length} transactions`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <div className="space-y-5">
        <Card title="Profile">
          <form onSubmit={saveName} className="flex items-end gap-2">
            <Field label="Your name" className="flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
            <Button type="submit" variant="secondary" loading={savingName} disabled={name.trim() === fullname || !name.trim()}>Save</Button>
          </form>
          <p className="mt-3 text-sm text-muted">Username: <span className="font-medium text-[var(--text)]">{username}</span></p>
          <Button variant="secondary" className="mt-3" onClick={() => setPasswordOpen(true)}>Change password</Button>
        </Card>

        <Card title="Appearance">
          <Segmented<ThemeChoice> value={theme} onChange={setTheme} options={[
            { value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' },
          ]} />
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            {theme === 'system' ? <Monitor className="h-3.5 w-3.5" /> : theme === 'light' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {theme === 'system' ? 'Follows your device setting' : `Always ${theme}`}
          </p>
        </Card>

        <Card title="Total balance">
          <p className="mb-3 text-sm text-muted">Choose which kinds of account count toward the total balance on Home.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(ACCOUNT_TYPES) as AccountType[]).map((t) => {
              const Icon = ACCOUNT_ICONS[t];
              const count = accounts.filter((a) => a.type === t && !a.archived).length;
              return (
                <li key={t}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-app px-3 py-2.5 transition hover:bg-[var(--surface-2)]">
                    <input type="checkbox" checked={!excluded.includes(t)} onChange={(e) => toggleType(t, e.target.checked)}
                      className="h-4 w-4 accent-[var(--color-brand-600)]" />
                    <Icon className="h-4 w-4 text-muted" />
                    <span className="flex-1 text-sm font-medium">{ACCOUNT_TYPES[t]}</span>
                    <span className="text-xs text-muted">{count} account{count === 1 ? '' : 's'}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title={<span className="flex items-center gap-2"><Tags className="h-4 w-4" /> Categories</span>}
          action={<Button size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4" /> New</Button>}>
          <Segmented className="mb-3" value={kind} onChange={setKind} options={[{ value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }]} />
          <ul className="divide-y divide-[var(--border)]">
            {idx.tree(kind).map((c) => (
              <li key={c.id} className="py-2">
                <button className="flex w-full items-center gap-3 text-left" onClick={() => setEditing({ category: c })}>
                  <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                  <span className="flex-1 font-medium">{c.name}</span>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </button>
                <div className="ml-11 mt-1.5 flex flex-wrap gap-1.5">
                  {c.children.map((s) => (
                    <button key={s.id} onClick={() => setEditing({ category: s, parent: c })}
                      className="rounded-full border border-app px-2.5 py-0.5 text-xs hover:bg-[var(--surface-2)]">{s.name}</button>
                  ))}
                  <button onClick={() => setEditing({ parent: c })}
                    className="rounded-full border border-dashed border-app px-2.5 py-0.5 text-xs text-muted hover:text-[var(--text)]">+ Sub</button>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Your data">
          <Button variant="secondary" onClick={exportAll}><Download className="h-4 w-4" /> Export all transactions (CSV)</Button>
        </Card>

        <Button variant="secondary" className="w-full text-rose-600" onClick={async () => {
          if (await confirm({ title: 'Sign out?', message: 'Your data stays saved in your account.', confirmLabel: 'Sign out' })) signOut();
        }}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>

      {editing && <CategorySheet kind={kind} category={editing.category} parent={editing.parent} onClose={() => setEditing(null)} />}
      {passwordOpen && <PasswordSheet onClose={() => setPasswordOpen(false)} />}
    </div>
  );
}

function CategorySheet({ kind, category, parent, onClose }: {
  kind: CategoryKind; category?: Category; parent?: CategoryNode; onClose: () => void;
}) {
  const confirm = useConfirm();
  const isSub = !!parent || !!category?.parent_id;
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? parent?.icon ?? 'Tag');
  const [color, setColor] = useState(category?.color ?? parent?.color ?? CATEGORY_COLORS[6]);
  const save = useDataMutation(saveCategory, { success: category ? 'Category updated' : 'Category added' });
  const remove = useDataMutation(deleteCategory, { success: 'Category deleted' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!(await save.run({
      id: category?.id, name, kind: category?.kind ?? kind, parent_id: category?.parent_id ?? parent?.id ?? null,
      icon, color, sort_order: category?.sort_order,
    }))) return;
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={category ? 'Edit category' : isSub ? `New subcategory of ${parent?.name}` : 'New category'}
      footer={
        <div className="flex gap-2">
          {category && (
            <Button variant="ghost" className="text-rose-600" aria-label="Delete category" onClick={async () => {
              const ok = await confirm({
                title: `Delete ${category.name}?`,
                message: isSub
                  ? 'Transactions in it become uncategorised.'
                  : 'Its subcategories and any budgets for it are deleted too. Transactions in it become uncategorised.',
                confirmLabel: 'Delete', danger: true,
              });
              if (ok) { if (!(await remove.run(category.id))) return; onClose(); }
            }}><Trash2 className="h-4 w-4" /></Button>
          )}
          <Button type="submit" form="category-form" className="flex-1" loading={save.isPending}>Save</Button>
        </div>
      }>
      <form id="category-form" onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3">
          <CategoryIcon icon={icon} color={color} size="lg" />
          <Field label="Name" className="flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoFocus={!category} /></Field>
        </div>
        {!isSub && (
          <>
            <div>
              <p className="mb-1.5 text-sm font-medium">Colour</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Colour ${c}`}
                    className={clsx('h-8 w-8 rounded-full ring-offset-2 ring-offset-[var(--surface)] transition', color === c && 'ring-2 ring-[var(--text)]')}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">Icon</p>
              <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12">
                {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
                  <button key={key} type="button" onClick={() => setIcon(key)} aria-label={key}
                    className={clsx('grid aspect-square place-items-center rounded-lg transition', icon === key ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400' : 'text-muted hover:bg-[var(--surface-2)]')}>
                    <Icon className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </form>
    </Sheet>
  );
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || !/\d/.test(password) || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
      return setError('Use at least 8 characters with upper and lower case letters and a number');
    }
    if (password !== confirmPw) return setError('The passwords don’t match');
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(err.message);
    toast.success('Password changed');
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title="Change password"
      footer={<Button type="submit" form="password-form" className="w-full" loading={busy}>Change password</Button>}>
      <form id="password-form" onSubmit={submit} className="space-y-4">
        <Field label="New password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus /></Field>
        <Field label="Confirm new password"><Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" /></Field>
        {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
      </form>
    </Sheet>
  );
}
