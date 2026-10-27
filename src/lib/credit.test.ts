import { describe, expect, it } from 'vitest';
import { available, exceedsLimit, isCard, owed, utilisation } from './credit';

const card = (balance: number, credit_limit: number | null = 50000) => ({ type: 'credit' as const, balance, credit_limit });

describe('credit cards', () => {
  it('recognises cards by account type', () => {
    expect(isCard({ type: 'credit' })).toBe(true);
    expect(isCard({ type: 'bank' })).toBe(false);
  });

  it('treats a negative balance as the amount owed', () => {
    expect(owed(card(-12000))).toBe(12000);
    expect(owed(card(0))).toBe(0);
    expect(owed(card(500))).toBe(0); // overpaid: in credit, nothing owed
  });

  it('works out available credit and how much of the limit is used', () => {
    expect(available(card(-12000))).toBe(38000);
    expect(utilisation(card(-12000))).toBe(24);
    expect(available(card(-60000))).toBe(-10000);
  });

  it('has no available amount or utilisation without a limit', () => {
    expect(available(card(-100, null))).toBeNull();
    expect(utilisation(card(-100, null))).toBeNull();
  });

  it('flags spending beyond the available credit, only for cards with a limit', () => {
    expect(exceedsLimit(card(-45000), 5000)).toBe(false);
    expect(exceedsLimit(card(-45000), 5001)).toBe(true);
    expect(exceedsLimit(card(-45000, null), 999999)).toBe(false);
    expect(exceedsLimit({ type: 'bank', balance: 0, credit_limit: null }, 999999)).toBe(false);
  });
});
