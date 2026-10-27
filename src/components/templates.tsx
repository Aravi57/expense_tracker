import clsx from 'clsx';
import { Pencil, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useAccounts } from '../api/accounts';
import { useCategoryIndex } from '../api/categories';
import { refreshAll, useDataMutation } from '../api/client';
import { addFromTemplate, deleteTemplate, saveTemplate } from '../api/templates';
import { deleteTransaction } from '../api/transactions';
import { money } from '../lib/format';
import type { Template, TxnType } from '../lib/types';
import { AccountPicker } from './AccountPicker';
import { CategoryIcon } from './CategoryIcon';
import { CategoryPicker } from './CategoryPicker';
import { useConfirm } from './confirm';
import { Button, Field, Input, Segmented, Select, Sheet } from './ui';

// Tapping a template adds its transaction straight away (dated today), with an
// Undo in the toast. A template without an amount asks for one first.
export function useApplyTemplate() {
  const [asking, setAsking] = useState<Template | null>(null);

  const add = async (t: Template, amount?: number) => {
    try {
      const id = await addFromTemplate(t.id, amount);
      await refreshAll();
      toast.success(`Added ${t.name} · ${money(amount ?? t.amount)}`, {
        action: { label: 'Undo', onClick: () => deleteTransaction(id).then(refreshAll, (e: Error) => toast.error(e.message)) },
      });
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  };

  const apply = (t: Template) => (t.amount ? void add(t) : setAsking(t));

  const prompt = asking && (
    <AmountPrompt template={asking} onClose={() => setAsking(null)} onAdd={async (value) => { if (await add(asking, value)) setAsking(null); }} />
  );

  return { apply, prompt };
}

function AmountPrompt({ template, onClose, onAdd }: { template: Template; onClose: () => void; onAdd: (amount: number) => Promise<void> }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const value = Number(amount) || 0;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!(value > 0)) return;
    setBusy(true);
    await onAdd(Math.round(value * 100) / 100);
    setBusy(false);
  };
  return (
    <Sheet open onClose={onClose} title={template.name}
      footer={<Button type="submit" form="template-amount" className="w-full" size="lg" loading={busy} disabled={!(value > 0)}>Add {money(value)}</Button>}>
      <form id="template-amount" onSubmit={submit}>
        <Field label="Amount (₹)">
          <Input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
      </form>
    </Sheet>
  );
}

export function TemplateTile({ template, onApply, onEdit }: { template: Template; onApply: () => void; onEdit?: () => void }) {
  const idx = useCategoryIndex();
  const { data: accounts = [] } = useAccounts();
  const root = idx.root(template.category_id);
  const account = accounts.find((a) => a.id === template.account_id);
  return (
    <div className="relative">
      <button type="button" onClick={onApply} aria-label={`Add ${template.name}`}
        className="surface flex w-full items-center gap-3 rounded-2xl p-3 pr-10 text-left transition hover:border-brand-500/60 active:scale-[0.98]">
        <CategoryIcon icon={root?.icon} color={root?.color} transfer={template.type === 'transfer'} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{template.name}</span>
          <span className="block truncate text-xs text-muted">
            <span className={clsx('font-semibold tabular-nums',
              template.type === 'income' && 'text-[var(--color-income)]', template.type === 'expense' && 'text-[var(--color-expense)]')}>
              {template.amount ? money(template.amount) : 'Enter amount'}
            </span>
            {account && ` · ${account.name}`}
          </span>
        </span>
      </button>
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label={`Edit ${template.name} template`}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-[var(--surface-2)] hover:text-[var(--text)]">
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function TemplateSheet({ template, onClose }: { template?: Template; onClose: () => void }) {
  const confirm = useConfirm();
  const idx = useCategoryIndex();
  const { data: accounts = [] } = useAccounts();
  const active = accounts.filter((a) => !a.archived || a.id === template?.account_id || a.id === template?.to_account_id);
  const [name, setName] = useState(template?.name ?? '');
  const [type, setType] = useState<TxnType>(template?.type ?? 'expense');
  const [amount, setAmount] = useState(template?.amount ? String(template.amount) : '');
  const [categoryId, setCategoryId] = useState<string | null>(template?.category_id ?? null);
  const [accountId, setAccountId] = useState(template?.account_id ?? '');
  const [toAccountId, setToAccountId] = useState(template?.to_account_id ?? '');
  const [error, setError] = useState('');
  const save = useDataMutation(saveTemplate, { success: template ? 'Template updated' : 'Template saved' });
  const remove = useDataMutation(deleteTemplate, { success: 'Template deleted' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Give it a name, e.g. Tea or Rent');
    if (amount !== '' && !(Number(amount) > 0)) return setError('The amount must be more than 0, or leave it empty');
    if (type === 'transfer' && (!accountId || !toAccountId || accountId === toAccountId)) return setError('Choose two different accounts');
    if (!(await save.run({
      id: template?.id, name, type, amount: amount === '' ? null : Number(amount), description: '',
      category_id: categoryId, account_id: accountId || null, to_account_id: toAccountId || null,
    }))) return;
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={template ? 'Edit template' : 'New template'}
      footer={
        <div className="flex gap-2">
          {template && (
            <Button variant="ghost" className="text-rose-600" aria-label="Delete template" onClick={async () => {
              if (await confirm({ title: `Delete "${template.name}"?`, message: 'Transactions already added from it are kept.', confirmLabel: 'Delete', danger: true })) {
                if (await remove.run(template.id)) onClose();
              }
            }}><Trash2 className="h-4 w-4" /></Button>
          )}
          <Button type="submit" form="template-form" className="flex-1" loading={save.isPending}>Save template</Button>
        </div>
      }>
      <form id="template-form" onSubmit={submit} className="space-y-4">
        <Segmented value={type} onChange={(t) => { setType(t); if (categoryId && idx.byId.get(categoryId)?.kind !== t) setCategoryId(null); }} options={[
          { value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }, { value: 'transfer', label: 'Transfer' },
        ]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tea" maxLength={40} autoFocus={!template} /></Field>
          <Field label="Amount (₹)" hint="Leave empty to enter it each time">
            <Input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        </div>
        {type !== 'transfer' && (
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Category</span>
            <CategoryPicker kind={type} value={categoryId} onChange={setCategoryId} />
          </div>
        )}
        {type === 'transfer' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="From account">
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Choose…</option>
                {active.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="To account">
              <Select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                <option value="">Choose…</option>
                {active.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
          </div>
        ) : active.length > 0 && (
          <AccountPicker label={type === 'expense' ? 'Paid with' : 'Received in'} accounts={active} value={accountId} onChange={setAccountId} />
        )}
        {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
      </form>
    </Sheet>
  );
}
