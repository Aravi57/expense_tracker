import { useState, type FormEvent } from 'react';
import { useAccounts } from '../api/accounts';
import { useDataMutation } from '../api/client';
import { saveTransaction } from '../api/transactions';
import { isCard, owed } from '../lib/credit';
import { today } from '../lib/dates';
import { money } from '../lib/format';
import type { Account } from '../lib/types';
import { Button, Field, Input, Select, Sheet } from './ui';

// Paying a card bill is a transfer from a bank/cash account to the card: it
// lowers what's owed without counting the purchases as spending a second time.
export function PayCardSheet({ card, onClose }: { card: Account; onClose: () => void }) {
  const { data: accounts = [] } = useAccounts();
  const sources = accounts.filter((a) => !a.archived && !isCard(a));
  const due = owed(card);
  const [fromId, setFromId] = useState(sources[0]?.id ?? '');
  const [amount, setAmount] = useState(due ? String(due) : '');
  const [date, setDate] = useState(today());
  const [error, setError] = useState('');
  const pay = useDataMutation(saveTransaction, { success: `Paid ${card.name}` });
  const from = sources.find((a) => a.id === fromId);
  const value = Number(amount) || 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fromId) return setError('Choose the account you’re paying from');
    if (!(value > 0)) return setError('Enter an amount greater than 0');
    if (!(await pay.run({
      type: 'transfer', amount: Math.round(value * 100) / 100, description: `Card bill: ${card.name}`, notes: null,
      occurred_on: date, category_id: null, account_id: fromId, to_account_id: card.id,
    }))) return;
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={`Pay ${card.name}`}
      footer={<Button type="submit" form="pay-card-form" className="w-full" size="lg" loading={pay.isPending}>Pay {money(value)}</Button>}>
      <form id="pay-card-form" onSubmit={submit} className="space-y-4">
        <div className="surface-2 flex items-baseline justify-between rounded-2xl p-4">
          <span className="text-sm text-muted">Outstanding</span>
          <span className="text-2xl font-bold tabular-nums">{money(due)}</span>
        </div>
        {sources.length === 0 ? (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            Add a bank or cash account first to pay the card from.
          </p>
        ) : (
          <Field label="Pay from">
            <Select value={fromId} onChange={(e) => setFromId(e.target.value)}>
              {sources.map((a) => <option key={a.id} value={a.id}>{a.name} ({money(a.balance)})</option>)}
            </Select>
          </Field>
        )}
        <div className="space-y-1.5">
          <Field label="Amount (₹)">
            <Input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          {due > 0 && (
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setAmount(String(due))}>Full {money(due)}</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setAmount(String(Math.ceil(due * 0.05)))}>Minimum (5%)</Button>
            </div>
          )}
        </div>
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        {from && value > from.balance && (
          <p className="text-xs text-amber-600 dark:text-amber-400">This is more than {from.name} holds ({money(from.balance)}).</p>
        )}
        {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
      </form>
    </Sheet>
  );
}
