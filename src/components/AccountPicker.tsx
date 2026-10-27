import clsx from 'clsx';
import { Banknote, CircleDashed, CreditCard, Landmark, LineChart, Wallet, type LucideIcon } from 'lucide-react';
import { available, isCard } from '../lib/credit';
import { money } from '../lib/format';
import type { Account, AccountType } from '../lib/types';

export const ACCOUNT_ICONS: Record<AccountType, LucideIcon> = {
  bank: Landmark, cash: Banknote, credit: CreditCard, wallet: Wallet, investment: LineChart, other: CircleDashed,
};

// "Paid with" / "Received in": tap a bank account, cash, wallet or credit card.
// Cards show the credit still available.
export function AccountPicker({ label, accounts, value, onChange }: {
  label: string; accounts: Account[]; value: string; onChange: (id: string) => void;
}) {
  const options = [...accounts].sort((a, b) => Number(isCard(a)) - Number(isCard(b)));
  return (
    <div className="space-y-1.5">
      <span id="account-picker-label" className="text-sm font-medium">{label}</span>
      <div role="radiogroup" aria-labelledby="account-picker-label" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {options.map((a) => {
          const Icon = ACCOUNT_ICONS[a.type];
          const left = isCard(a) ? available(a) : null;
          const selected = value === a.id;
          return (
            <button key={a.id} type="button" role="radio" aria-checked={selected} aria-label={a.name} onClick={() => onChange(a.id)}
              className={clsx('flex min-w-32 shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition',
                selected ? 'border-brand-500 bg-brand-500/10' : 'border-app hover:bg-[var(--surface-2)]')}>
              <Icon className={clsx('h-5 w-5 shrink-0', selected ? 'text-brand-600 dark:text-brand-400' : 'text-muted')} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{a.name}</span>
                <span className="block truncate text-xs text-muted">
                  {isCard(a) ? (left === null ? 'Credit card' : `${money(left)} available`) : money(a.balance)}
                </span>
              </span>
            </button>
          );
        })}
        <button type="button" role="radio" aria-checked={value === ''} aria-label="No account" onClick={() => onChange('')}
          className={clsx('shrink-0 rounded-xl border px-3 py-2 text-sm transition',
            value === '' ? 'border-brand-500 bg-brand-500/10' : 'border-app text-muted hover:bg-[var(--surface-2)]')}>
          None
        </button>
      </div>
    </div>
  );
}
