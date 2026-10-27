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
    await expect(app.getByText('Nothing scheduled')).toBeVisible();
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

    const names = () => app.locator('main section p.font-semibold').allTextContents();
    await expect.poll(names).toEqual(['Food', 'Transport']);
    await app.getByRole('button', { name: 'Move down' }).first().click();
    await expect.poll(names).toEqual(['Transport', 'Food']);

    await app.getByText('Transport', { exact: true }).click();
    await app.getByRole('dialog').getByRole('button', { name: 'Delete budget' }).click();
    await app.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect.poll(names).toEqual(['Food']);
  });
});

test.describe('Recurring', () => {
  test('a rule that is already due is recorded immediately, and can be paused', async ({ app, mock }) => {
    await goTo(app, 'Recurring');
    await app.getByRole('button', { name: 'New', exact: true }).click();
    const sheet = app.getByRole('dialog');
    await sheet.getByLabel('Name').fill('Netflix');
    await sheet.getByLabel('Amount (₹)').fill('649');
    await sheet.getByRole('button', { name: 'Other', exact: true }).click();
    await expect(sheet.getByText('The first one is due now')).toBeVisible();
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(app.getByText('Recurring added')).toBeVisible();
    await expect(app.getByRole('button', { name: /Netflix.*Monthly · next/ })).toBeVisible();
    await expect(app.getByText('₹649').first()).toBeVisible();

    const txns = mock.rows('et_transactions', mock.users[0].id);
    expect(txns).toHaveLength(1);
    expect(txns[0]).toMatchObject({ description: 'Netflix', amount: 649, occurred_on: todayIso });

    await app.getByRole('button', { name: 'Pause' }).click();
    await expect(app.getByText('Paused', { exact: true })).toBeVisible();
    await expect(app.getByRole('button', { name: /Netflix.*paused/ })).toBeVisible();
  });

  test('catches up on missed occurrences when the app opens', async ({ page, mock, errors }) => {
    void errors;
    const user = mock.users[0];
    const d = new Date();
    d.setDate(d.getDate() - 15);
    mock.tables.et_recurring.push({
      id: crypto.randomUUID(), user_id: user.id, type: 'expense', amount: 50, description: 'Daily milk', frequency: 'weekly',
      next_date: isoDate(d), end_date: null, active: true, category_id: null, account_id: null, to_account_id: null,
    });
    await page.goto('./');
    await page.getByLabel('Username').fill(USERNAME);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Recorded 3 recurring transactions')).toBeVisible();
    await expect(page.getByRole('button', { name: /Daily milk/ })).toHaveCount(3);
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
      ['Analysis', 'Analysis'], ['Recurring', 'Recurring'], ['Settings', 'Settings'], ['Home', 'E2E Tester'],
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
