import { useState, type FormEvent } from 'react';
import { Archive, CreditCard, Trash2 } from 'lucide-react';
import { deleteAccount, saveAccount, setAccountArchived } from '../api/accounts';
import { useDataMutation } from '../api/client';
import { available, owed } from '../lib/credit';
import { ACCOUNT_TYPES, money } from '../lib/format';
import type { Account, AccountType } from '../lib/types';
import { useConfirm } from './confirm';
import { PayCardSheet } from './PayCardSheet';
import { Button, Field, Input, ProgressBar, Select, Sheet } from './ui';

export function AccountSheet({ account, onClose }: { account?: Account; onClose: () => void }) {
  const confirm = useConfirm();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'bank');
  const card = type === 'credit';
  // Users edit today's balance (or, for a card, what they owe today); we store the
  // matching opening balance so existing transactions stay as they are
  const [amount, setAmount] = useState(account ? String(account.type === 'credit' ? owed(account) : account.balance) : '');
  const [limit, setLimit] = useState(account?.credit_limit ? String(account.credit_limit) : '');
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  const save = useDataMutation(saveAccount, { success: account ? 'Account updated' : 'Account added' });
  const archive = useDataMutation((a: Account) => setAccountArchived(a.id, !a.archived), {
    success: (_, a) => (a.archived ? 'Account restored' : 'Account archived'),
  });
  const remove = useDataMutation(deleteAccount, { success: 'Account deleted' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = Number(amount || 0);
    if (card && value < 0) return setError('Enter what you owe as a positive amount (0 if paid off)');
    if (card && limit && !(Number(limit) > 0)) return setError('The credit limit must be more than 0');
    const target = card ? -value : value;
    const opening = account ? account.opening_balance + (target - account.balance) : target;
    if (!(await save.run({
      id: account?.id, name, type, opening_balance: Math.round(opening * 100) / 100,
      credit_limit: card && limit ? Number(limit) : null,
    }))) return;
    onClose();
  };

  const onDelete = async () => {
    if (!account) return;
    const ok = await confirm({
      title: `Delete ${account.name}?`,
      message: 'The account is removed. Its transactions are kept but will no longer belong to an account. Archive it instead to hide it but keep everything linked.',
      confirmLabel: 'Delete account',
      danger: true,
    });
    if (ok) {
      if (!(await remove.run(account.id))) return;
      onClose();
    }
  };

  if (paying && account) return <PayCardSheet card={account} onClose={onClose} />;

  const savedCard = account?.type === 'credit' ? account : null;
  const left = savedCard ? available(savedCard) : null;

  return (
    <Sheet open onClose={onClose} title={account ? 'Edit account' : 'Add account'}
      footer={
        <div className="flex gap-2">
          {account && (
            <>
              <Button variant="ghost" onClick={onDelete} className="text-rose-600" aria-label="Delete account"><Trash2 className="h-4 w-4" /></Button>
              <Button variant="ghost" onClick={async () => { if (!(await archive.run(account))) return; onClose(); }}>
                <Archive className="h-4 w-4" /> {account.archived ? 'Restore' : 'Archive'}
              </Button>
            </>
          )}
          <Button type="submit" form="account-form" className="flex-1" loading={save.isPending}>Save</Button>
        </div>
      }>
      <form id="account-form" onSubmit={submit} className="space-y-4">
        {savedCard && (
          <div className="surface-2 space-y-2 rounded-2xl p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">Owed now</span>
              <span className="text-xl font-bold tabular-nums">{money(owed(savedCard))}</span>
            </div>
            {savedCard.credit_limit && (
              <>
                <ProgressBar value={(owed(savedCard) / savedCard.credit_limit) * 100} />
                <p className="text-xs text-muted">{money(left)} available of {money(savedCard.credit_limit)}</p>
              </>
            )}
            {owed(savedCard) > 0 && (
              <Button type="button" className="w-full" onClick={() => setPaying(true)}>
                <CreditCard className="h-4 w-4" /> Pay card bill
              </Button>
            )}
          </div>
        )}
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={card ? 'e.g. HDFC Millennia card' : 'e.g. HDFC Savings'} maxLength={40} required autoFocus={!account} />
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => { setType(e.target.value as AccountType); setError(''); }}>
            {Object.entries(ACCOUNT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        {card && (
          <Field label="Credit limit (₹)" hint="Optional. Used to show how much credit you have left.">
            <Input type="number" inputMode="decimal" min="1" step="1" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="e.g. 100000" />
          </Field>
        )}
        <Field label={card ? 'Amount owed now (₹)' : 'Current balance (₹)'}
          hint={card
            ? 'Your current outstanding on the card. Enter 0 if it’s fully paid.'
            : account ? `Changing this adjusts the starting balance; transactions stay as they are. Started at ${money(account.opening_balance)}.` : 'What the account holds today.'}>
          <Input type="number" inputMode="decimal" step="0.01" min={card ? '0' : undefined} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </Field>
        {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
      </form>
    </Sheet>
  );
}
