import { test as base, expect, type Page } from '@playwright/test';
import { MockSupabase, STORAGE_KEY } from './mock-supabase';

export const USERNAME = 'e2e_tester';
export const PASSWORD = 'Testing123';

interface Fixtures {
  mock: MockSupabase;
  /** Opens the app already signed in as the test user */
  app: Page;
  /** Console errors and page crashes seen during the test */
  errors: string[];
}

export const test = base.extend<Fixtures>({
  mock: async ({ context }, use) => {
    const mock = new MockSupabase();
    mock.addUser(USERNAME, PASSWORD, 'E2E Tester');
    await mock.install(context);
    await use(mock);
    // Every Supabase call the app made must have been understood, and nothing may leave the machine
    expect(mock.unhandled, 'requests the mock did not handle').toEqual([]);
    expect(mock.blocked, 'requests to other hosts').toEqual([]);
  },

  errors: async ({ page }, use) => {
    const errors: string[] = [];
    // Browsers log every failed HTTP response; tests that expect a 4xx (wrong password,
    // duplicate budget) check the outcome themselves, so those lines aren't app errors
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await use(errors);
    expect(errors, 'console errors').toEqual([]);
  },

  app: async ({ page, mock, errors }, use) => {
    void errors;
    const session = mock.session(mock.users[0]);
    await page.addInitScript(([key, value]) => {
      if (!sessionStorage.getItem('e2e-started')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('e2e-started', '1');
      }
    }, [STORAGE_KEY, JSON.stringify(session)] as const);
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'E2E Tester' })).toBeVisible();
    await use(page);
  },
});

export { expect };

// The phone layout puts some screens under "More"
export async function goTo(page: Page, name: string) {
  const isMobile = (page.viewportSize()?.width ?? 1280) < 1024;
  if (isMobile && ['Analysis', 'Templates', 'Settings'].includes(name)) {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('dialog').getByRole('link', { name }).click();
  } else {
    const nav = isMobile ? page.locator('nav').last() : page.locator('aside nav');
    await nav.getByRole('link', { name: name === 'Transactions' ? 'Activity' : name, exact: true }).click();
  }
}

export async function openAddTransaction(page: Page) {
  await page.getByRole('button', { name: 'Add transaction' }).filter({ visible: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

// Fill and submit the add-transaction sheet
export async function addTransaction(page: Page, t: {
  type?: 'Expense' | 'Income' | 'Transfer'; amount: string; description: string; category?: string;
  subcategory?: string; account?: string; toAccount?: string; date?: string;
}) {
  await openAddTransaction(page);
  const sheet = page.getByRole('dialog');
  if (t.type && t.type !== 'Expense') await sheet.getByRole('radio', { name: t.type }).click();
  await sheet.getByPlaceholder('0', { exact: true }).fill(t.amount);
  await sheet.getByLabel('Description').fill(t.description);
  if (t.category) await sheet.getByRole('button', { name: t.category, exact: true }).click();
  // Subcategory chips come after the category grid (and may share a name, e.g. Food › Food)
  if (t.subcategory) await sheet.getByRole('button', { name: t.subcategory, exact: true }).last().click();
  if (t.account && t.type === 'Transfer') await sheet.getByLabel('From account').selectOption({ label: t.account });
  else if (t.account) await sheet.getByRole('radiogroup').getByRole('radio', { name: t.account, exact: true }).click();
  if (t.toAccount) await sheet.getByLabel('To account').selectOption({ label: t.toAccount });
  if (t.date) await sheet.getByLabel('Date').fill(t.date);
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

// For a credit card, `balance` is the amount owed and `limit` the credit limit
export async function addAccount(page: Page, name: string, balance: string, type = 'Bank account', limit?: string) {
  await page.getByRole('button', { name: 'Add account' }).first().click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Name').fill(name);
  await sheet.getByLabel('Type').selectOption({ label: type });
  if (type === 'Credit card') {
    if (limit) await sheet.getByLabel('Credit limit (₹)').fill(limit);
    await sheet.getByLabel('Amount owed now (₹)').fill(balance);
  } else {
    await sheet.getByLabel('Current balance (₹)').fill(balance);
  }
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}
