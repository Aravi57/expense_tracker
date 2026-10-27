import { createContext, useCallback, useContext, useState, type FormEvent, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAccounts } from '../api/accounts';
import { useCategoryIndex } from '../api/categories';
import { refreshAll, useDataMutation } from '../api/client';
import { deleteTransaction, restoreTransaction, saveTransaction } from '../api/transactions';
import { today } from '../lib/dates';
import type { Transaction, TxnType } from '../lib/types';
import { useConfirm } from './confirm';
import { CategoryPicker } from './CategoryPicker';
import { Button, Field, Input, Segmented, Select, Sheet, Textarea } from './ui';

interface OpenOptions {
  transaction?: Transaction;
  type?: TxnType;
}

const SheetContext = createContext<((opts?: OpenOptions) => void) | null>(null);

// Opens the add / edit transaction sheet from anywhere: useTransactionSheet()({ transaction })
export function useTransactionSheet() {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error('useTransactionSheet must be used inside TransactionSheetProvider');
  return ctx;
}

export function TransactionSheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ key: number; opts: OpenOptions } | null>(null);
  const open = useCallback((opts: OpenOptions = {}) => setState({ key: Date.now(), opts }), []);

  return (
    <SheetContext.Provider value={open}>
      {children}
      {state && <TransactionForm key={state.key} {...state.opts} onClose={() => setState(null)} />}
    </SheetContext.Provider>
  );
}

// "Undo" after a delete puts the transaction back
export function useDeleteTransaction() {
  return useDataMutation(async (t: Transaction) => {
    await deleteTransaction(t.id);
    return t;
  }, {
    success: (t) => {
      toast('Transaction deleted', {
        action: { label: 'Undo', onClick: () => restoreTransaction(t).then(refreshAll, (e: Error) => toast.error(e.message)) },
      });
      return undefined;
    },
  });
}

function TransactionForm({ transaction, type: initialType, onClose }: OpenOptions & { onClose: () => void }) {
  const editing = !!transaction;
  const { data: accounts = [] } = useAccounts();
  const idx = useCategoryIndex();
  const confirm = useConfirm();
  const activeAccounts = accounts.filter((a) => !a.archived || a.id === transaction?.account_id || a.id === transaction?.to_account_id);

  const [type, setType] = useState<TxnType>(transaction?.type ?? initialType ?? 'expense');
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '');
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.category_id ?? null);
  const [accountId, setAccountId] = useState(transaction?.account_id ?? activeAccounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(transaction?.to_account_id ?? '');
  const [date, setDate] = useState(transaction?.occurred_on ?? today());
  const [notes, setNotes] = useState(transaction?.notes ?? '');
  const [showNotes, setShowNotes] = useState(!!transaction?.notes);
  const [error, setError] = useState('');

  const changeType = (t: TxnType) => {
    setType(t);
    // A category only fits its own kind
    if (categoryId && idx.byId.get(categoryId)?.kind !== t) setCategoryId(null);
  };

  const save = useDataMutation(saveTransaction, {
    success: () => (editing ? 'Transaction updated' : `${type[0].toUpperCase()}${type.slice(1)} added`),
  });
  const remove = useDeleteTransaction();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return setError('Enter an amount greater than 0');
    if (type === 'transfer' && (!accountId || !toAccountId)) return setError('Choose both accounts for a transfer');
    if (type === 'transfer' && accountId === toAccountId) return setError('Choose two different accounts');
    setError('');

    if (!(await save.run({
      id: transaction?.id,
      type,
      amount: Math.round(value * 100) / 100,
      description: description.trim() || (type === 'transfer' ? 'Transfer' : idx.label(categoryId)),
      notes: notes || null,
      occurred_on: date,
      category_id: type === 'transfer' ? null : categoryId,
      account_id: accountId || null,
      to_account_id: type === 'transfer' ? toAccountId : null,
      investment_id: transaction?.investment_id ?? null,
    }))) return;
    onClose();
  };

  const onDelete = async () => {
    if (!transaction) return;
    if (await confirm({ title: 'Delete transaction?', message: `"${transaction.description}" will be removed. You can undo this straight after.`, confirmLabel: 'Delete', danger: true })) {
      if (!(await remove.run(transaction))) return;
      onClose();
    }
  };

  return (
    <Sheet open onClose={onClose} title={editing ? 'Edit transaction' : 'Add transaction'}
      footer={
        <div className="flex gap-2">
          {editing && (
            <Button type="button" variant="ghost" onClick={onDelete} aria-label="Delete transaction" className="text-rose-600">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
          <Button type="submit" form="txn-form" className="flex-1" size="lg" loading={save.isPending}>
            {editing ? 'Save changes' : 'Add'}
          </Button>
        </div>
      }>
      <form id="txn-form" onSubmit={submit} className="space-y-5">
        <Segmented value={type} onChange={changeType} options={[
          { value: 'expense', label: 'Expense', activeClass: 'text-rose-600 dark:text-rose-400' },
          { value: 'income', label: 'Income', activeClass: 'text-emerald-600 dark:text-emerald-400' },
          { value: 'transfer', label: 'Transfer', activeClass: 'text-brand-600 dark:text-brand-400' },
        ]} />

        <label className="block text-center">
          <span className="sr-only">Amount</span>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-3xl font-semibold text-muted">₹</span>
            <input autoFocus={!editing} inputMode="decimal" type="number" step="0.01" min="0" placeholder="0"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-48 bg-transparent text-center text-5xl font-bold tracking-tight outline-none placeholder:text-[var(--muted)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
        </label>

        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={80}
            placeholder={type === 'transfer' ? 'e.g. Move to savings' : 'e.g. Groceries at Reliance'} />
        </Field>

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
              {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          {type === 'transfer' ? (
            <Field label="To account">
              <Select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                <option value="">Choose…</option>
                {activeAccounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
          ) : (
            <Field label="Date">
              <Input type="date" value={date} max="2999-12-31" onChange={(e) => setDate(e.target.value)} required />
            </Field>
          )}
        </div>
        {type === 'transfer' && (
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        )}

        {showNotes ? (
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} />
          </Field>
        ) : (
          <button type="button" className="text-sm font-medium text-brand-600 dark:text-brand-400" onClick={() => setShowNotes(true)}>
            + Add a note
          </button>
        )}

        {accounts.length === 0 && (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            Tip: add an account on the Home screen to track balances.
          </p>
        )}
        {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
      </form>
    </Sheet>
  );
}
