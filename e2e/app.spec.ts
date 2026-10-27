import type { Page } from '@playwright/test';
import { addAccount, addTransaction, expect, goTo, openAddTransaction, PASSWORD, test, USERNAME } from './fixtures';
import { isoDate } from './mock-supabase';

const todayIso = isoDate(new Date());

test.describe('Sign in and sign up', () => {
  test('rejects a wrong password, then signs in', async ({ page, mock, errors }) => {
    void mock; void errors;
    await page.goto('./');
    await page.getByLabel('Username').fill(USERNAME);
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toHaveText('Incorrect username or password');

    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'E2E Tester' })).toBeVisible();
  });

  test('creates a new account and gives it the default categories', async ({ page, mock, errors }) => {
    void errors;
    await page.goto('./');
    await page.getByRole('radio', { name: 'Sign up' }).click();
    await page.getByLabel('Full name').fill('New Person');
    await page.getByLabel('Username').fill('new.person');
    await page.getByLabel('Password', { exact: true }).fill('Newpass123');
    await page.getByLabel('Confirm password').fill('Newpass123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'New Person' })).toBeVisible();
    await expect.poll(() => mock.rows('et_categories', mock.users[1].id).length).toBeGreaterThan(10);
  });

  test('refuses a username that is already taken', async ({ page, mock, errors }) => {
    void mock; void errors;
    await page.goto('./');
    await page.getByRole('radio', { name: 'Sign up' }).click();
    await page.getByLabel('Full name').fill('Copy Cat');
    await page.getByLabel('Username').fill(USERNAME);
    await page.getByLabel('Password', { exact: true }).fill('Newpass123');
    await page.getByLabel('Confirm password').fill('Newpass123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('alert')).toHaveText('That username is taken. Please choose another.');
  });

  test('stays signed in after a reload and can sign out', async ({ app }) => {
    await app.reload();
    await expect(app.getByRole('heading', { name: 'E2E Tester' })).toBeVisible();
    await goTo(app, 'Settings');
    await app.getByRole('button', { name: 'Sign out' }).click();
    await app.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
    await expect(app.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
});

test.describe('Home', () => {
  test('starts empty with helpful prompts', async ({ app }) => {
    await expect(app.getByText('No transactions yet')).toBeVisible();
    await expect(app.getByText('No budgets yet')).toBeVisible();
    await expect(app.getByText(/Save things you add often/)).toBeVisible();
    await expect(app.getByText('Total balance')).toBeVisible();
  });

  test('adds accounts and totals their balances', async ({ app }) => {
    await addAccount(app, 'HDFC', '10000');
    await addAccount(app, 'Wallet', '500', 'Cash');
    await expect(app.getByRole('button', { name: /HDFC.*₹10,000/ })).toBeVisible();
    await expect(app.getByRole('button', { name: /Wallet.*₹500/ })).toBeVisible();
    await expect(app.getByText('₹10,500')).toBeVisible();
    await expect(app.getByText('Across 2 accounts')).toBeVisible();
  });

  test('editing an account balance keeps its transactions intact', async ({ app, mock }) => {
    await addAccount(app, 'HDFC', '1000');
    await addTransaction(app, { amount: '200', description: 'Groceries', category: 'Grocery', account: 'HDFC' });
    await expect(app.getByRole('button', { name: /HDFC.*₹800/ })).toBeVisible();

    await app.getByRole('button', { name: /HDFC.*₹800/ }).click();
    await app.getByRole('dialog').getByLabel('Current balance (₹)').fill('1500');
    await app.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(app.getByRole('button', { name: /HDFC.*₹1,500/ })).toBeVisible();
    const [acc] = mock.rows('et_accounts', mock.users[0].id);
    expect(acc.opening_balance).toBe(1700); // 1500 now + the 200 already spent
  });
});

test.describe('Transactions', () => {
  test('adds an expense that updates balance, spending and recent activity', async ({ app }) => {
    await addAccount(app, 'HDFC', '5000');
    await addTransaction(app, { amount: '250', description: 'Lunch', category: 'Food', account: 'HDFC' });
    await expect(app.getByText('Expense added')).toBeVisible();
    await expect(app.getByRole('button', { name: /HDFC.*₹4,750/ })).toBeVisible();
    await expect(app.getByRole('button', { name: /Lunch/ })).toBeVisible();
    await expect(app.getByRole('button', { name: /Lunch.*Food · HDFC.*−₹250/ })).toBeVisible();
  });

  test('records income and a transfer between accounts', async ({ app }) => {
    await addAccount(app, 'HDFC', '1000');
    await addAccount(app, 'Savings', '0');
    await addTransaction(app, { type: 'Income', amount: '50000', description: 'October salary', category: 'Salary', account: 'HDFC' });
    await addTransaction(app, { type: 'Transfer', amount: '20000', description: 'Save', account: 'HDFC', toAccount: 'Savings' });
    await expect(app.getByRole('button', { name: /^HDFC.*₹31,000/ })).toBeVisible();
    await expect(app.getByRole('button', { name: /^Savings.*₹20,000/ })).toBeVisible();
    await expect(app.getByRole('button', { name: /Save.*HDFC → Savings/ })).toBeVisible();
    // A transfer is neither income nor spending
    await expect(app.getByText('₹51,000')).toBeVisible();
  });

  test('validates the form', async ({ app }) => {
    await openAddTransaction(app);
    const sheet = app.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(sheet.getByRole('alert')).toHaveText('Enter an amount greater than 0');
    await sheet.getByRole('radio', { name: 'Transfer' }).click();
    await sheet.getByPlaceholder('0', { exact: true }).fill('10');
    await sheet.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(sheet.getByRole('alert')).toHaveText('Choose both accounts for a transfer');
  });

  test('edits a transaction', async ({ app }) => {
    await addTransaction(app, { amount: '100', description: 'Coffee', category: 'Food' });
    await app.getByRole('button', { name: /Coffee/ }).click();
    const sheet = app.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: 'Edit transaction' })).toBeVisible();
    await sheet.getByPlaceholder('0', { exact: true }).fill('180');
    await sheet.getByLabel('Description').fill('Coffee and cake');
    await sheet.getByRole('button', { name: 'Save changes' }).click();
    await expect(app.getByRole('button', { name: /Coffee and cake.*−₹180/ })).toBeVisible();
  });

  test('deletes a transaction after confirming, and Undo brings it back', async ({ app, mock }) => {
    await addTransaction(app, { amount: '75', description: 'Snack', category: 'Food' });
    await app.getByRole('button', { name: /Snack/ }).click();
    await app.getByRole('dialog').getByRole('button', { name: 'Delete transaction' }).click();
    await app.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(app.getByText('Transaction deleted')).toBeVisible();
    await expect(app.getByRole('button', { name: /Snack/ })).toBeHidden();
    expect(mock.rows('et_transactions', mock.users[0].id)).toHaveLength(0);

    await app.getByRole('button', { name: 'Undo' }).click();
    await expect(app.getByRole('button', { name: /Snack/ })).toBeVisible();
    expect(mock.rows('et_transactions', mock.users[0].id)).toHaveLength(1);
  });

  test('searches, filters, changes month and exports CSV', async ({ app }) => {
    await addTransaction(app, { amount: '120', description: 'Uber ride', category: 'Transport' });
    await addTransaction(app, { amount: '900', description: 'Big Bazaar', category: 'Grocery' });
    await addTransaction(app, { type: 'Income', amount: '3000', description: 'Freelance', category: 'Other income' });
    await goTo(app, 'Transactions');
    await expect(app.getByRole('heading', { name: 'Activity' })).toBeVisible();
    await expect(app.getByRole('button', { name: /Uber ride/ })).toBeVisible();

    await app.getByLabel('Search transactions').fill('bazaar');
    await expect(app.getByRole('button', { name: /Big Bazaar/ })).toBeVisible();
    await expect(app.getByRole('button', { name: /Uber ride/ })).toBeHidden();
    await app.getByRole('button', { name: 'Clear filters' }).click();

    await app.getByLabel('Type').selectOption('income');
    await expect(app.getByRole('button', { name: /Freelance/ })).toBeVisible();
    await expect(app.getByRole('button', { name: /Uber ride/ })).toBeHidden();
    await app.getByLabel('Type').selectOption('');

    await app.getByLabel('Category').selectOption({ label: 'Transport' });
    await expect(app.getByRole('button', { name: /Uber ride/ })).toBeVisible();
    await expect(app.getByRole('button', { name: /Big Bazaar/ })).toBeHidden();
    await app.getByRole('button', { name: 'Clear filters' }).click();

    const download = app.waitForEvent('download');
    await app.getByRole('button', { name: 'Export CSV' }).click();
    const file = await download;
    const csv = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
    expect(file.suggestedFilename()).toMatch(/^transactions_\d{4}-\d{2}-01\.csv$/);
    expect(csv).toContain('Date,Type,Description,Category,Account,To account,Amount,Notes');
    expect(csv).toContain(`${todayIso},expense,Big Bazaar,Grocery,,,900.00,`);

    await app.getByRole('button', { name: 'Previous month' }).click();
    await expect(app.getByText('No transactions this month')).toBeVisible();
    await app.getByRole('button', { name: 'All time' }).click();
    await expect(app.getByRole('button', { name: /Uber ride/ })).toBeVisible();
  });

  test('shows a subcategory and groups by day with daily totals', async ({ app }) => {
    await addTransaction(app, { amount: '15000', description: 'Flat rent', category: 'Home', subcategory: 'Rent' });
    await addTransaction(app, { amount: '400', description: 'Old bill', category: 'Home', date: '2026-10-01' });
    await goTo(app, 'Transactions');
    await app.getByRole('button', { name: 'All time' }).click();
    await expect(app.getByRole('button', { name: /Flat rent.*Home › Rent/ })).toBeVisible();
    await expect(app.getByText('Today')).toBeVisible();
    await expect(app.getByText('Thu, 1 Oct 2026')).toBeVisible();
  });
});

test.describe('Credit cards', () => {
  test('adds a card with a limit, spends on it, and pays the bill from a bank account', async ({ app, mock }) => {
    await addAccount(app, 'HDFC', '100000');
    await addAccount(app, 'Millennia', '0', 'Credit card', '50000');
    await expect(app.getByRole('button', { name: /^Millennia.*Owed.*₹0.*₹50,000 available/ })).toBeVisible();

    // Pay for something with the card
    await addTransaction(app, { amount: '12000', description: 'New phone', category: 'Shopping', account: 'Millennia' });
    await expect(app.getByRole('button', { name: /^Millennia.*Owed.*₹12,000.*₹38,000 available/ })).toBeVisible();
    await expect(app.getByText('₹38,000 available · 24% used')).toBeVisible();
    await expect(app.getByText('after ₹12,000 owed on cards')).toBeVisible();
    // The bank balance is untouched by card spending
    await expect(app.getByRole('button', { name: /^HDFC.*₹1,00,000/ })).toBeVisible();

    // Pay the full bill from HDFC
    await app.getByRole('button', { name: 'Pay bill' }).click();
    const pay = app.getByRole('dialog');
    await expect(pay.getByRole('heading', { name: 'Pay Millennia' })).toBeVisible();
    await expect(pay.getByLabel('Pay from')).toHaveValue(/.+/);
    await expect(pay.getByLabel('Amount (₹)')).toHaveValue('12000');
    await pay.getByRole('button', { name: 'Pay ₹12,000' }).click();
    await expect(app.getByText('Paid Millennia')).toBeVisible();

    await expect(app.getByRole('button', { name: /^Millennia.*Owed.*₹0.*₹50,000 available/ })).toBeVisible();
    await expect(app.getByRole('button', { name: /^HDFC.*₹88,000/ })).toBeVisible();
    // The phone counts as spending once; the bill payment is a transfer, not more spending
    await expect(app.getByRole('button', { name: /Card bill: Millennia.*HDFC → Millennia/ })).toBeVisible();
    const user = mock.users[0].id;
    expect(mock.rows('et_transactions', user).map((t) => [t.type, t.amount])).toEqual([['expense', 12000], ['transfer', 12000]]);
    await expect(app.getByText('No spending yet this month')).toBeHidden();
    await expect(app.locator('section', { hasText: 'Spending this month' }).getByText('₹12,000').first()).toBeVisible();
  });

  test('warns when an expense goes over the credit limit', async ({ app }) => {
    await addAccount(app, 'Coral', '9000', 'Credit card', '10000');
    await openAddTransaction(app);
    const sheet = app.getByRole('dialog');
    await sheet.getByRole('radio', { name: 'Coral', exact: true }).click();
    await expect(sheet.getByRole('radio', { name: 'Coral', exact: true })).toContainText('₹1,000 available');
    await sheet.getByPlaceholder('0', { exact: true }).fill('800');
    await expect(sheet.getByText(/over its credit limit/)).toBeHidden();
    await sheet.getByPlaceholder('0', { exact: true }).fill('1500');
    await expect(sheet.getByText('This takes Coral over its credit limit (₹1,000 available).')).toBeVisible();
  });

  test('editing a card shows what is owed and accepts a new limit', async ({ app, mock }) => {
    await addAccount(app, 'Amex', '2500', 'Credit card', '20000');
    await app.getByRole('button', { name: /^Amex/ }).click();
    const sheet = app.getByRole('dialog');
    await expect(sheet.getByText('₹17,500 available of ₹20,000')).toBeVisible();
    await expect(sheet.getByLabel('Amount owed now (₹)')).toHaveValue('2500');
    await sheet.getByLabel('Credit limit (₹)').fill('30000');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(app.getByRole('button', { name: /^Amex.*₹27,500 available/ })).toBeVisible();
    const [card] = mock.rows('et_accounts', mock.users[0].id);
    expect(card).toMatchObject({ type: 'credit', credit_limit: 30000, opening_balance: -2500 });
  });
});

test.describe('Budgets', () => {
  test('creates a budget, tracks spending including subcategories, and warns when over', async ({ app }) => {
    await goTo(app, 'Budgets');
    await app.getByRole('button', { name: 'New budget' }).click();
    const sheet = app.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Save budget' }).click();
    await expect(sheet.getByRole('alert')).toHaveText('Choose a category');
    await sheet.getByRole('button', { name: 'Food', exact: true }).click();
    await sheet.getByLabel('Limit (₹)').fill('1000');
    await sheet.getByRole('button', { name: 'Save budget' }).click();
    await expect(app.getByText('Budget created')).toBeVisible();
    await expect(app.getByText('₹0 of ₹1,000')).toBeVisible();

    await addTransaction(app, { amount: '600', description: 'Dinner', category: 'Food', subcategory: 'Food' });
    await expect(app.getByText('₹600 of ₹1,000')).toBeVisible();
    await expect(app.getByRole('progressbar').last()).toHaveAttribute('aria-valuenow', '60');

    await addTransaction(app, { amount: '700', description: 'Party', category: 'Food' });
    await expect(app.getByText('Over budget: Food')).toBeVisible();
    await expect(app.getByText('₹300 over')).toBeVisible();
  });

  test('refuses a duplicate budget and can reorder and delete', async ({ app }) => {
    await goTo(app, 'Budgets');
    for (const cat of ['Food', 'Transport']) {
      await app.getByRole('button', { name: 'New budget' }).click();
      await app.getByRole('dialog').getByRole('button', { name: cat, exact: true }).click();
      await app.getByRole('dialog').getByLabel('Limit (₹)').fill('500');
      await app.getByRole('dialog').getByRole('button', { name: 'Save budget' }).click();
      await expect(app.getByRole('dialog')).toBeHidden();
    }
    await app.getByRole('button', { name: 'New budget' }).click();
    await app.getByRole('dialog').getByRole('button', { name: 'Food', exact: true }).click();
    await app.getByRole('dialog').getByLabel('Limit (₹)').fill('800');
    await app.getByRole('dialog').getByRole('button', { name: 'Save budget' }).click();
    await expect(app.getByText('There is already a budget for that category and period')).toBeVisible();
    await app.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

    const names = () => app.locator('main section > button span.truncate.font-semibold').allTextContents();
    await expect.poll(names).toEqual(['Food', 'Transport']);
    await app.getByRole('button', { name: 'Move down' }).first().click();
    await expect.poll(names).toEqual(['Transport', 'Food']);

    await app.getByText('Transport', { exact: true }).click();
    await app.getByRole('dialog').getByRole('button', { name: 'Delete budget' }).click();
    await app.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect.poll(names).toEqual(['Food']);
  });
});

test.describe('Budget groups', () => {
  async function addBudget(page: import('@playwright/test').Page, category: string, sub: string | null, limit: string) {
    await page.getByRole('button', { name: 'New budget' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: category, exact: true }).click();
    if (sub) await sheet.getByRole('button', { name: sub, exact: true }).last().click();
    await sheet.getByLabel('Limit (₹)').fill(limit);
    await sheet.getByRole('button', { name: 'Save budget' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }

  test('subcategory budgets share one card that expands to show each', async ({ app }) => {
    await addTransaction(app, { amount: '15000', description: 'Flat rent', category: 'Home', subcategory: 'Rent' });
    await addTransaction(app, { amount: '1200', description: 'Electricity', category: 'Home', subcategory: 'EB' });
    await goTo(app, 'Budgets');
    await addBudget(app, 'Home', 'Rent', '15000');
    await addBudget(app, 'Home', 'EB', '1000');
    await addBudget(app, 'Food', null, '4000');

    // One card for Home with the two budgets added together, one for Food
    const home = app.getByRole('button', { name: 'Home budgets' });
    await expect(home).toContainText('2 budgets');
    await expect(home).toContainText('₹16,200 of ₹16,000');
    await expect(home).toHaveAttribute('aria-expanded', 'false');
    await expect(app.getByRole('button', { name: 'Edit Food budget' })).toBeVisible();
    await expect(app.getByText('₹200 over')).toBeVisible();

    // Expand to see each subcategory
    await expect(app.getByRole('button', { name: 'Edit Rent budget' })).toBeHidden();
    await home.click();
    await expect(home).toHaveAttribute('aria-expanded', 'true');
    await expect(app.getByRole('button', { name: 'Edit Rent budget' })).toContainText('₹15,000 / ₹15,000');
    await expect(app.getByRole('button', { name: 'Edit EB budget' })).toContainText('₹1,200 / ₹1,000');

    // Overview counts each rupee once: 15,000 + 1,000 + 4,000
    await expect(app.getByText('₹20,000').first()).toBeVisible();

    // Edit a subcategory budget from inside the group
    await app.getByRole('button', { name: 'Edit EB budget' }).click();
    await app.getByRole('dialog').getByLabel('Limit (₹)').fill('1500');
    await app.getByRole('dialog').getByRole('button', { name: 'Save budget' }).click();
    await expect(home).toContainText('₹16,200 of ₹16,500');

    // Collapse again
    await home.click();
    await expect(app.getByRole('button', { name: 'Edit Rent budget' })).toBeHidden();
  });

  test('a main-category budget becomes the total and is not double counted', async ({ app }) => {
    await addTransaction(app, { amount: '15000', description: 'Flat rent', category: 'Home', subcategory: 'Rent' });
    await goTo(app, 'Budgets');
    await addBudget(app, 'Home', 'Rent', '15000');
    await addBudget(app, 'Home', null, '20000');
    const home = app.getByRole('button', { name: 'Home budgets' });
    await expect(home).toContainText('₹15,000 of ₹20,000');
    await home.click();
    await expect(app.getByRole('button', { name: 'Edit All of Home budget' })).toBeVisible();
    // Overview uses the Home budget only, not Home + Rent
    await expect(app.getByText('Monthly budget')).toBeVisible();
    await expect(app.locator('section', { hasText: 'Monthly budget' }).getByText('₹20,000')).toBeVisible();

    // "Add a budget in Home" starts with Home picked
    await app.getByRole('button', { name: 'Add a budget in Home' }).click();
    const sheet = app.getByRole('dialog');
    await sheet.getByRole('button', { name: 'EB', exact: true }).click();
    await sheet.getByLabel('Limit (₹)').fill('1000');
    await sheet.getByRole('button', { name: 'Save budget' }).click();
    await expect(home).toContainText('3 budgets');
  });
});

test.describe('Naming an "Other" subcategory in a budget', () => {
  async function startBudget(page: import('@playwright/test').Page, category: string) {
    await goTo(page, 'Budgets');
    await page.getByRole('button', { name: 'New budget' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: category, exact: true }).click();
    return sheet;
  }

  test('creates the named subcategory, budgets it, and offers it for transactions', async ({ app, mock }) => {
    const sheet = await startBudget(app, 'Home');
    await expect(sheet.getByLabel('Subcategory name')).toBeHidden();
    await sheet.getByRole('button', { name: 'Other', exact: true }).last().click();
    await sheet.getByLabel('Subcategory name').fill('Maintenance');
    await sheet.getByLabel('Limit (₹)').fill('3000');
    await sheet.getByRole('button', { name: 'Save budget' }).click();
    await expect(app.getByText('Budget created')).toBeVisible();
    await expect(app.getByRole('button', { name: 'Edit Home › Maintenance budget' })).toContainText('₹0 of ₹3,000');

    const user = mock.users[0].id;
    const home = mock.rows('et_categories', user).find((c) => c.name === 'Home' && !c.parent_id)!;
    const sub = mock.rows('et_categories', user).find((c) => c.name === 'Maintenance')!;
    expect(sub).toMatchObject({ parent_id: home.id, kind: 'expense', icon: home.icon });
    expect(mock.rows('et_budgets', user)[0].category_id).toBe(sub.id);

    // It's now a subcategory for transactions, and spending there counts toward the budget
    await addTransaction(app, { amount: '1200', description: 'Plumber', category: 'Home', subcategory: 'Maintenance' });
    await expect(app.getByRole('button', { name: 'Edit Home › Maintenance budget' })).toContainText('₹1,200 of ₹3,000');
  });

  test('reuses an existing subcategory with the same name instead of duplicating it', async ({ app, mock }) => {
    const user = mock.users[0].id;
    const sheet = await startBudget(app, 'Home');
    const before = mock.rows('et_categories', user).length;
    await sheet.getByRole('button', { name: 'Other', exact: true }).last().click();
    await sheet.getByLabel('Subcategory name').fill('  rent ');
    await sheet.getByLabel('Limit (₹)').fill('15000');
    await sheet.getByRole('button', { name: 'Save budget' }).click();
    await expect(app.getByRole('button', { name: 'Edit Home › Rent budget' })).toBeVisible();
    expect(mock.rows('et_categories', user)).toHaveLength(before);
  });

  test('leaving the name empty keeps "Other"', async ({ app, mock }) => {
    const user = mock.users[0].id;
    const sheet = await startBudget(app, 'Home');
    const before = mock.rows('et_categories', user).length;
    await sheet.getByRole('button', { name: 'Other', exact: true }).last().click();
    await sheet.getByLabel('Limit (₹)').fill('500');
    await sheet.getByRole('button', { name: 'Save budget' }).click();
    await expect(app.getByText('Budget created')).toBeVisible();
    expect(mock.rows('et_categories', user)).toHaveLength(before);
    // A lone "Other" subcategory is labelled with just its parent
    await expect(app.getByRole('button', { name: 'Edit Home budget' })).toBeVisible();
  });
});

test.describe('Templates', () => {
  async function newTemplate(page: Page, t: { name: string; amount?: string; type?: 'Income'; category?: string; account?: string }) {
    await page.getByRole('button', { name: 'New template' }).click();
    const sheet = page.getByRole('dialog');
    if (t.type) await sheet.getByRole('radio', { name: t.type }).click();
    await sheet.getByLabel('Name').fill(t.name);
    if (t.amount) await sheet.getByLabel('Amount (₹)').fill(t.amount);
    if (t.category) await sheet.getByRole('button', { name: t.category, exact: true }).click();
    if (t.account) await sheet.getByRole('radiogroup').getByRole('radio', { name: t.account, exact: true }).click();
    await sheet.getByRole('button', { name: 'Save template' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }

  test('one tap adds the transaction today, and Undo removes it', async ({ app, mock }) => {
    await addAccount(app, 'HDFC', '5000');
    await goTo(app, 'Templates');
    await expect(app.getByText('No templates yet')).toBeVisible();
    await newTemplate(app, { name: 'Tea', amount: '20', category: 'Food', account: 'HDFC' });
    await expect(app.getByText('Template saved')).toBeVisible();

    await app.getByRole('button', { name: 'Add Tea' }).click();
    await expect(app.getByText('Added Tea · ₹20')).toBeVisible();
    const user = mock.users[0].id;
    expect(mock.rows('et_transactions', user)).toHaveLength(1);
    expect(mock.rows('et_transactions', user)[0]).toMatchObject({ type: 'expense', amount: 20, description: 'Tea', occurred_on: todayIso });
    expect(mock.rows('et_templates', user)[0].use_count).toBe(1);

    await app.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => mock.rows('et_transactions', user).length).toBe(0);
  });

  test('a template without an amount asks for one', async ({ app, mock }) => {
    await goTo(app, 'Templates');
    await newTemplate(app, { name: 'Petrol', category: 'Transport' });
    await expect(app.getByRole('button', { name: 'Add Petrol' })).toContainText('Enter amount');
    await app.getByRole('button', { name: 'Add Petrol' }).click();
    const sheet = app.getByRole('dialog');
    await sheet.getByLabel('Amount (₹)').fill('1500');
    await sheet.getByRole('button', { name: 'Add ₹1,500' }).click();
    await expect(app.getByText('Added Petrol · ₹1,500')).toBeVisible();
    expect(mock.rows('et_transactions', mock.users[0].id)[0]).toMatchObject({ amount: 1500, description: 'Petrol' });
  });

  test('shows on Home for quick add, and fills the add form', async ({ app, mock }) => {
    await goTo(app, 'Templates');
    await newTemplate(app, { name: 'Salary', amount: '60000', type: 'Income', category: 'Salary' });
    await goTo(app, 'Home');
    await expect(app.getByRole('heading', { name: 'Quick add' })).toBeVisible();
    await app.getByRole('button', { name: 'Add Salary' }).click();
    await expect(app.getByText('Added Salary · ₹60,000')).toBeVisible();
    expect(mock.rows('et_transactions', mock.users[0].id)[0]).toMatchObject({ type: 'income', amount: 60000 });

    // In the add form, a template only fills the fields
    await openAddTransaction(app);
    const sheet = app.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Salary', exact: true }).first().click();
    await expect(sheet.getByRole('radio', { name: 'Income' })).toHaveAttribute('aria-checked', 'true');
    await expect(sheet.getByPlaceholder('0', { exact: true })).toHaveValue('60000');
    await expect(sheet.getByLabel('Description')).toHaveValue('Salary');
    expect(mock.rows('et_transactions', mock.users[0].id)).toHaveLength(1);
  });

  test('edits and deletes a template', async ({ app, mock }) => {
    await goTo(app, 'Templates');
    await newTemplate(app, { name: 'Coffee', amount: '150', category: 'Food' });
    await app.getByRole('button', { name: 'Edit Coffee template' }).click();
    await app.getByRole('dialog').getByLabel('Amount (₹)').fill('180');
    await app.getByRole('dialog').getByRole('button', { name: 'Save template' }).click();
    await expect(app.getByRole('button', { name: 'Add Coffee' })).toContainText('₹180');
    await app.getByRole('button', { name: 'Edit Coffee template' }).click();
    await app.getByRole('dialog').getByRole('button', { name: 'Delete template' }).click();
    await app.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(app.getByText('No templates yet')).toBeVisible();
    expect(mock.rows('et_templates', mock.users[0].id)).toHaveLength(0);
  });

  test('old Recurring links open Templates', async ({ app }) => {
    await app.goto('./#/recurring');
    await expect(app.getByRole('heading', { name: 'Templates', level: 1 })).toBeVisible();
  });
});

test.describe('Total balance by account type', () => {
  test('leaves unticked account types out of the total', async ({ app, mock }) => {
    await addAccount(app, 'HDFC', '10000');
    await addAccount(app, 'Zerodha', '50000', 'Investment');
    await expect(app.getByText('₹60,000')).toBeVisible();

    await goTo(app, 'Settings');
    const investment = app.getByRole('checkbox').nth(4); // bank, cash, credit, wallet, investment, other
    await expect(investment).toBeChecked();
    await investment.uncheck();
    await expect(app.getByText('Investment no longer counts toward the total balance')).toBeVisible();
    expect(mock.users[0].meta.balance_excludes).toEqual(['investment']);

    await goTo(app, 'Home');
    await expect(app.getByText('₹10,000').first()).toBeVisible();
    await expect(app.getByText(/Across 1 account/)).toBeVisible();
    await expect(app.getByRole('link', { name: 'not counting investment' })).toBeVisible();
    // The account card itself is still shown
    await expect(app.getByRole('button', { name: /^Zerodha.*₹50,000/ })).toBeVisible();
  });
});

test.describe('Account cards row', () => {
  test('shows scroll arrows when the cards do not fit', async ({ app }) => {
    for (const name of ['One', 'Two', 'Three', 'Four', 'Five', 'Six']) await addAccount(app, name, '100');
    // Adding through the "Add account" card scrolls to the end of the row; start from the beginning
    await app.getByRole('region', { name: 'Accounts' }).evaluate((el) => el.scrollTo({ left: 0, behavior: 'instant' }));
    const right = app.getByRole('button', { name: 'Scroll Accounts right' });
    await expect(right).toBeVisible();
    await expect(app.getByRole('button', { name: 'Scroll Accounts left' })).toBeHidden();
    // The arrow is on screen and the page itself doesn't scroll sideways
    await expect(right).toBeInViewport();
    expect(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await right.click();
    await expect(app.getByRole('button', { name: 'Scroll Accounts left' })).toBeVisible();
  });
});

test.describe('Naming a new main category from "Other" in a budget', () => {
  test('creates the main category and budgets it', async ({ app, mock }) => {
    await goTo(app, 'Budgets');
    await app.getByRole('button', { name: 'New budget' }).click();
    const sheet = app.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Other', exact: true }).first().click();
    await sheet.getByLabel('Category name').fill('Pets');
    await sheet.getByLabel('Limit (₹)').fill('2000');
    await sheet.getByRole('button', { name: 'Save budget' }).click();
    await expect(app.getByRole('button', { name: 'Edit Pets budget' })).toContainText('₹0 of ₹2,000');
    const pets = mock.rows('et_categories', mock.users[0].id).find((c) => c.name === 'Pets');
    expect(pets).toMatchObject({ parent_id: null, kind: 'expense' });

    // It's a main category for transactions too
    await openAddTransaction(app);
    await expect(app.getByRole('dialog').getByRole('button', { name: 'Pets', exact: true })).toBeVisible();
  });
});

test.describe('Investments', () => {
  test('adds an investment, tops it up and records the top-up as an expense', async ({ app, mock }) => {
    await addAccount(app, 'HDFC', '100000');
    await goTo(app, 'Investments');
    await expect(app.getByText('No investments yet')).toBeVisible();
    await app.getByRole('button', { name: 'Add investment' }).click();
    const sheet = app.getByRole('dialog');
    await sheet.getByLabel('Name').fill('Nifty Index Fund');
    await sheet.getByLabel('Type').selectOption({ label: 'Mutual fund' });
    await sheet.getByLabel('Total invested (₹)').fill('50000');
    await sheet.getByLabel('Current value (₹)').fill('56000');
    await sheet.getByRole('button', { name: 'Save' }).click();

    await expect(app.getByText('Nifty Index Fund').first()).toBeVisible();
    await expect(app.getByText('+₹6,000')).toBeVisible();
    await expect(app.getByText('12.0%').first()).toBeVisible();

    await app.getByRole('button', { name: 'Top up' }).click();
    const topup = app.getByRole('dialog');
    await topup.getByLabel('Amount (₹)').fill('5000');
    await expect(topup.getByText('₹55,000')).toBeVisible();
    await topup.getByLabel('Paid from').selectOption({ label: 'HDFC' });
    await topup.getByRole('button', { name: 'Add top-up' }).click();
    await expect(app.getByText('Top-up added')).toBeVisible();
    await expect(app.getByText('Invested ₹55,000')).toBeVisible();

    const user = mock.users[0].id;
    expect(mock.rows('et_investment_contributions', user)).toHaveLength(1);
    expect(mock.rows('et_transactions', user)[0]).toMatchObject({ description: 'Top-up: Nifty Index Fund', amount: 5000, type: 'expense' });

    // Charts render
    await expect(app.locator('.recharts-surface').first()).toBeVisible();

    // The top-up shows in the history and removing it lowers the invested amount again
    await app.getByRole('button', { name: /Nifty Index Fund/ }).click();
    await expect(app.getByRole('dialog').getByText('Top-up history')).toBeVisible();
    await app.getByRole('dialog').getByRole('button', { name: 'Remove top-up' }).click();
    await expect(app.getByText('Top-up removed')).toBeVisible();
    await app.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await expect(app.getByText('Invested ₹50,000')).toBeVisible();
  });
});

test.describe('Analysis', () => {
  test('summarises the month with charts and insights', async ({ app }) => {
    await addTransaction(app, { type: 'Income', amount: '40000', description: 'Salary', category: 'Salary' });
    await addTransaction(app, { amount: '15000', description: 'Rent', category: 'Home' });
    await addTransaction(app, { amount: '5000', description: 'Food', category: 'Food' });
    await goTo(app, 'Analysis');
    await expect(app.getByRole('heading', { name: 'Analysis' })).toBeVisible();
    await expect(app.getByText('₹20,000').first()).toBeVisible(); // net savings
    await expect(app.getByText('50%').first()).toBeVisible(); // savings rate
    await expect(app.getByText('You saved 50% of your income. Keep it up.')).toBeVisible();
    await expect(app.getByText('Home is your biggest expense at 75% of spending.')).toBeVisible();
    await expect(app.locator('.recharts-wrapper')).toHaveCount(3); // income vs expenses, savings, categories

    await app.getByRole('button', { name: 'Previous month' }).click();
    await expect(app.getByText('No spending in this period')).toBeVisible();
  });
});

test.describe('Settings', () => {
  test('adds a category that then appears in the picker', async ({ app }) => {
    await goTo(app, 'Settings');
    await app.getByRole('button', { name: 'New', exact: true }).click();
    const sheet = app.getByRole('dialog');
    await sheet.getByLabel('Name').fill('Pets');
    await sheet.getByRole('button', { name: 'PawPrint' }).click();
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(app.getByText('Category added')).toBeVisible();
    await expect(app.getByRole('button', { name: 'Pets' })).toBeVisible();

    await openAddTransaction(app);
    await expect(app.getByRole('dialog').getByRole('button', { name: 'Pets', exact: true })).toBeVisible();
  });

  test('switches theme, renames the profile and changes the password', async ({ app, mock }) => {
    await goTo(app, 'Settings');
    await app.getByRole('radio', { name: 'Dark' }).click();
    await expect(app.locator('html')).toHaveClass(/dark/);
    await app.getByRole('radio', { name: 'Light' }).click();
    await expect(app.locator('html')).not.toHaveClass(/dark/);

    await app.getByLabel('Your name').fill('Renamed Tester');
    await app.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(app.getByText('Name updated')).toBeVisible();
    expect(mock.users[0].meta.fullname).toBe('Renamed Tester');

    await app.getByRole('button', { name: 'Change password' }).click();
    const sheet = app.getByRole('dialog');
    await sheet.getByLabel('New password', { exact: true }).fill('short');
    await sheet.getByLabel('Confirm new password').fill('short');
    await sheet.getByRole('button', { name: 'Change password' }).click();
    await expect(sheet.getByRole('alert')).toContainText('at least 8 characters');
    await sheet.getByLabel('New password', { exact: true }).fill('Newpass456');
    await sheet.getByLabel('Confirm new password').fill('Newpass456');
    await sheet.getByRole('button', { name: 'Change password' }).click();
    await expect(app.getByText('Password changed')).toBeVisible();
    expect(mock.users[0].password).toBe('Newpass456');
  });
});

test.describe('Navigation', () => {
  test('every screen opens without errors', async ({ app }) => {
    for (const [name, heading] of [
      ['Transactions', 'Activity'], ['Budgets', 'Budgets'], ['Investments', 'Investments'],
      ['Analysis', 'Analysis'], ['Templates', 'Templates'], ['Settings', 'Settings'], ['Home', 'E2E Tester'],
    ]) {
      await goTo(app, name);
      await expect(app.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    }
  });

  test('unknown addresses go back to Home', async ({ app }) => {
    await app.goto('./#/does-not-exist');
    await expect(app.getByRole('heading', { name: 'E2E Tester' })).toBeVisible();
  });
});
