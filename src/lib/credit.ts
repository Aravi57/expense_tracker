import type { Account } from './types';

// A credit card's balance is negative while money is owed on it.

export const isCard = (a: Pick<Account, 'type'>) => a.type === 'credit';

/** Amount owed on the card (0 when it's paid off or in credit) */
export const owed = (a: Pick<Account, 'balance'>) => Math.max(-a.balance, 0);

/** Credit still available, or null when the card has no limit */
export function available(a: Pick<Account, 'balance' | 'credit_limit'>) {
  return a.credit_limit == null ? null : a.credit_limit - owed(a);
}

/** Share of the limit in use, 0–100+ (null without a limit) */
export function utilisation(a: Pick<Account, 'balance' | 'credit_limit'>) {
  return a.credit_limit ? (owed(a) / a.credit_limit) * 100 : null;
}

/** Would spending `amount` on this card take it over its limit? */
export function exceedsLimit(a: Pick<Account, 'balance' | 'credit_limit' | 'type'>, amount: number) {
  const left = available(a);
  return isCard(a) && left !== null && amount > left;
}
