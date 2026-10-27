import { useState, type FormEvent } from 'react';
import { Archive, Trash2 } from 'lucide-react';
import { deleteAccount, saveAccount, setAccountArchived } from '../api/accounts';
import { useDataMutation } from '../api/client';
import { ACCOUNT_TYPES, money } from '../lib/format';
import type { Account, AccountType } from '../lib/types';
import { useConfirm } from './confirm';
import { Button, Field, Input, Select, Sheet } from './ui';

export function AccountSheet({ account, onClose }: { account?: Account; onClose: () => void }) {
  const confirm = useConfirm();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'bank');
  // For an existing account the user edits today's balance; we store the matching opening balance
  const [balance, setBalance] = useState(account ? String(account.balance) : '');

  const save = useDataMutation(saveAccount, { success: account ? 'Account updated' : 'Account added' });
  const archive = useDataMutation((a: Account) => setAccountArchived(a.id, !a.archived), {
    success: (_, a) => (a.archived ? 'Account restored' : 'Account archived'),
  });
  const remove = useDataMutation(deleteAccount, { success: 'Account deleted' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const target = Number(balance || 0);
    const opening = account ? account.opening_balance + (target - account.balance) : target;
    if (!(await save.run({ id: account?.id, name, type, opening_balance: Math.round(opening * 100) / 100 }))) return;
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
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HDFC Savings" maxLength={40} required autoFocus={!account} />
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {Object.entries(ACCOUNT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Current balance (₹)"
          hint={account ? `Changing this adjusts the starting balance; transactions stay as they are. Started at ${money(account.opening_balance)}.` : 'What the account holds today. Use a negative number for credit card debt.'}>
          <Input type="number" inputMode="decimal" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" />
        </Field>
      </form>
    </Sheet>
  );
}
