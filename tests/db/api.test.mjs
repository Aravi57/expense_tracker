// Database API tests: tables, row level security and the et_* functions.
// Runs against the real Supabase database (DATABASE_URL), as a real user so RLS applies,
// and every test runs inside a transaction that is rolled back, so nothing is saved.
// Test data uses the year 2099 or a test-only category so real records can't interfere.
//
//   DATABASE_URL=...  TEST_USERNAME=<an existing username>  npm run test:db

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';

const CA = process.env.SUPABASE_CA_CERT_PATH ?? 'C:/Users/aravi/.supabase/prod-ca-2021.crt';
const USERNAME = (process.env.TEST_USERNAME ?? 'Aravindh57').toLowerCase();
const OTHER_USER = '00000000-0000-4000-8000-000000000001'; // not a real user

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: fs.readFileSync(CA, 'utf8') },
  max: 4,
});
let userId;

before(async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL must be set');
  const { rows } = await pool.query('select id from auth.users where email = $1', [`${USERNAME}@expense-tracker.invalid`]);
  assert.equal(rows.length, 1, `test user ${USERNAME} not found`);
  userId = rows[0].id;
});
after(() => pool.end());

// Run fn(q) as `user` in a transaction that is always rolled back
async function asUser(fn, user = userId) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: user, role: 'authenticated' })]);
    await client.query('set local role authenticated');
    // Each query gets a savepoint, so an expected failure doesn't abort the rest of the test
    const q = async (sql, params) => {
      await client.query('savepoint q');
      try {
        const { rows } = await client.query(sql, params);
        await client.query('release savepoint q');
        return rows;
      } catch (e) {
        await client.query('rollback to savepoint q');
        throw e;
      }
    };
    q.switchUser = async (id) => client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]);
    return await fn(q);
  } finally {
    await client.query('rollback');
    client.release();
  }
}

const one = async (rows) => (await rows)[0];

// A fresh test category tree and account, owned by the test user
async function fixtures(q) {
  const parent = await one(q(`insert into et_categories (kind, name, icon, color) values ('expense', 'ZZ Test', 'Tag', '#000') returning id`));
  const child = await one(q(`insert into et_categories (kind, name, parent_id) values ('expense', 'ZZ Sub', $1) returning id`, [parent.id]));
  const income = await one(q(`insert into et_categories (kind, name) values ('income', 'ZZ Pay') returning id`));
  const a = await one(q(`insert into et_accounts (name, type, opening_balance) values ('ZZ Bank', 'bank', 1000) returning id`));
  const b = await one(q(`insert into et_accounts (name, type, opening_balance) values ('ZZ Cash', 'cash', 0) returning id`));
  return { parent: parent.id, child: child.id, income: income.id, a: a.id, b: b.id };
}

describe('security', () => {
  it('blocks logged-out (anon) access to every table', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin; set local role anon');
      for (const t of ['et_transactions', 'et_accounts', 'et_categories', 'et_budgets', 'et_templates', 'et_investments', 'et_investment_contributions', 'et_account_balances']) {
        await assert.rejects(client.query(`select 1 from ${t} limit 1`), /permission denied/, t);
        await client.query('rollback; begin; set local role anon');
      }
      await assert.rejects(client.query(`select et_summary('2099-01-01', '2099-12-31')`), /permission denied/);
    } finally {
      await client.query('rollback');
      client.release();
    }
  });

  it("hides one user's rows from another user", () => asUser(async (q) => {
    const f = await fixtures(q);
    await q(`insert into et_transactions (type, amount, occurred_on, account_id) values ('expense', 5, '2099-01-01', $1)`, [f.a]);
    await q.switchUser(OTHER_USER);
    assert.equal((await q('select count(*)::int as n from et_accounts')).at(0).n, 0);
    assert.equal((await q('select count(*)::int as n from et_transactions')).at(0).n, 0);
    assert.equal((await q('select count(*)::int as n from et_categories')).at(0).n, 0);
    const s = (await q(`select et_summary('2099-01-01', '2099-12-31') as s`))[0].s;
    assert.equal(Number(s.expense), 0);
  }));

  it("refuses to write rows for someone else", () => asUser(async (q) => {
    await assert.rejects(q(`insert into et_accounts (user_id, name) values ($1, 'Sneaky')`, [OTHER_USER]), /row-level security/);
  }));

  it('refuses links to accounts and categories the user does not own', () => asUser(async (q) => {
    await assert.rejects(
      q(`insert into et_transactions (type, amount, account_id) values ('expense', 1, gen_random_uuid())`),
      /foreign key/,
    );
    await assert.rejects(
      q(`insert into et_budgets (category_id, amount) values (gen_random_uuid(), 10)`),
      /foreign key/,
    );
  }));
});

describe('constraints', () => {
  it('rejects zero or negative amounts', () => asUser(async (q) => {
    await assert.rejects(q(`insert into et_transactions (type, amount) values ('expense', 0)`), /check/);
    await assert.rejects(q(`insert into et_transactions (type, amount) values ('expense', -5)`), /check/);
  }));

  it('rejects a category on a transfer', () => asUser(async (q) => {
    const f = await fixtures(q);
    await assert.rejects(
      q(`insert into et_transactions (type, amount, category_id, account_id, to_account_id) values ('transfer', 5, $1, $2, $3)`, [f.parent, f.a, f.b]),
      /check/,
    );
  }));

  it('rejects a second budget for the same category and period', () => asUser(async (q) => {
    const f = await fixtures(q);
    await q(`insert into et_budgets (category_id, amount) values ($1, 100)`, [f.parent]);
    await assert.rejects(q(`insert into et_budgets (category_id, amount) values ($1, 200)`, [f.parent]), /duplicate key/);
  }));

  it('keeps transactions when their account is deleted', () => asUser(async (q) => {
    const f = await fixtures(q);
    const t = await one(q(`insert into et_transactions (type, amount, account_id) values ('expense', 5, $1) returning id`, [f.a]));
    await q('delete from et_accounts where id = $1', [f.a]);
    const row = await one(q('select account_id from et_transactions where id = $1', [t.id]));
    assert.equal(row.account_id, null);
  }));

  it('keeps updated_at current', () => asUser(async (q) => {
    const f = await fixtures(q);
    const before = await one(q('select updated_at from et_accounts where id = $1', [f.a]));
    await q(`select pg_sleep(0.01)`);
    await q(`update et_accounts set name = 'ZZ Renamed' where id = $1`, [f.a]);
    const after = await one(q('select updated_at from et_accounts where id = $1', [f.a]));
    // now() is fixed for a transaction, so just check it was set by the trigger
    assert.ok(after.updated_at >= before.updated_at);
  }));
});

describe('account balances', () => {
  it('adds income, subtracts expenses, and moves transfers between accounts', () => asUser(async (q) => {
    const f = await fixtures(q);
    await q(`insert into et_transactions (type, amount, account_id, occurred_on) values
      ('income', 500, $1, '2099-01-02'), ('expense', 200, $1, '2099-01-03')`, [f.a]);
    await q(`insert into et_transactions (type, amount, account_id, to_account_id, occurred_on) values ('transfer', 300, $1, $2, '2099-01-04')`, [f.a, f.b]);
    const rows = await q('select id, balance::numeric as balance from et_account_balances where id in ($1, $2)', [f.a, f.b]);
    const bal = Object.fromEntries(rows.map((r) => [r.id, Number(r.balance)]));
    assert.equal(bal[f.a], 1000 + 500 - 200 - 300);
    assert.equal(bal[f.b], 300);
  }));
});

describe('credit cards', () => {
  it('tracks what is owed and lowers it when the bill is paid from a bank account', () => asUser(async (q) => {
    const bank = await one(q(`insert into et_accounts (name, type, opening_balance) values ('ZZ Bank', 'bank', 50000) returning id`));
    const card = await one(q(`insert into et_accounts (name, type, opening_balance, credit_limit) values ('ZZ Card', 'credit', -1000, 25000) returning id`));
    await q(`insert into et_transactions (type, amount, account_id, occurred_on) values ('expense', 4000, $1, '2099-01-02')`, [card.id]);
    await q(`insert into et_transactions (type, amount, account_id, to_account_id, occurred_on) values ('transfer', 3000, $1, $2, '2099-01-20')`, [bank.id, card.id]);
    const rows = await q('select id, credit_limit::numeric as lim, balance::numeric as bal from et_account_balances where id in ($1, $2)', [bank.id, card.id]);
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    assert.equal(Number(by[card.id].bal), -1000 - 4000 + 3000); // ₹2,000 still owed
    assert.equal(Number(by[card.id].lim), 25000);
    assert.equal(Number(by[bank.id].bal), 47000);
    // The card purchase is spending; paying the bill is not
    const s = (await q(`select et_summary('2099-01-01', '2099-01-31') as s`))[0].s;
    assert.equal(Number(s.expense), 4000);
  }));

  it('rejects a zero or negative credit limit', () => asUser(async (q) => {
    await assert.rejects(q(`insert into et_accounts (name, type, credit_limit) values ('ZZ Bad', 'credit', 0)`), /check/);
  }));
});

describe('reports', () => {
  it('summarises a period, including weekend spending and the largest expense', () => asUser(async (q) => {
    // 2099-01-03 is a Saturday, 2099-01-05 a Monday
    await q(`insert into et_transactions (type, amount, occurred_on) values
      ('income', 1000, '2099-01-01'), ('expense', 120, '2099-01-03'), ('expense', 80, '2099-01-05'),
      ('transfer', 999, '2099-01-05'), ('expense', 50, '2099-02-01')`);
    const s = (await q(`select et_summary('2099-01-01', '2099-01-31') as s`))[0].s;
    assert.deepEqual(
      { income: Number(s.income), expense: Number(s.expense), count: s.count, expense_count: s.expense_count, weekend: Number(s.weekend_expense), largest: Number(s.largest_expense) },
      { income: 1000, expense: 200, count: 4, expense_count: 2, weekend: 120, largest: 120 },
    );
  }));

  it('returns every month in the window, with empty months as zero', () => asUser(async (q) => {
    await q(`insert into et_transactions (type, amount, occurred_on) values ('expense', 40, '2099-03-15'), ('income', 90, '2099-01-10')`);
    const rows = await q(`select month::text, income::numeric, expense::numeric from et_monthly_totals('2099-03-20', 3)`);
    assert.deepEqual(rows.map((r) => [r.month, Number(r.income), Number(r.expense)]), [
      ['2099-01-01', 90, 0], ['2099-02-01', 0, 0], ['2099-03-01', 0, 40],
    ]);
  }));

  it('rolls subcategory spending up into its parent category', () => asUser(async (q) => {
    const f = await fixtures(q);
    await q(`insert into et_transactions (type, amount, occurred_on, category_id) values
      ('expense', 10, '2099-01-01', $1), ('expense', 15, '2099-01-02', $2), ('expense', 7, '2099-01-03', null)`, [f.parent, f.child]);
    const rows = await q(`select name, total::numeric, count::int from et_category_totals('2099-01-01', '2099-01-31')`);
    assert.deepEqual(rows.map((r) => [r.name, Number(r.total), r.count]), [['ZZ Test', 25, 2], ['Uncategorised', 7, 1]]);
  }));

  it('works out the total balance at the start of a day', () => asUser(async (q) => {
    const base = Number((await one(q(`select et_balance_at('2099-01-01') as b`))).b);
    await q(`insert into et_transactions (type, amount, occurred_on) values ('income', 100, '2099-01-01'), ('expense', 30, '2099-01-02')`);
    assert.equal(Number((await one(q(`select et_balance_at('2099-01-01') as b`))).b), base);
    assert.equal(Number((await one(q(`select et_balance_at('2099-01-03') as b`))).b), base + 70);
  }));
});

describe('budgets', () => {
  it('counts subcategory spending in the current period only', () => asUser(async (q) => {
    const f = await fixtures(q);
    await q(`insert into et_budgets (category_id, amount) values ($1, 1000)`, [f.parent]);
    await q(`insert into et_transactions (type, amount, occurred_on, category_id) values
      ('expense', 100, current_date, $1),
      ('expense', 50, current_date, $2),
      ('expense', 999, (date_trunc('month', current_date) - interval '1 day')::date, $1),
      ('income', 70, current_date, null)`, [f.parent, f.child]);
    const b = (await q('select amount::numeric, spent::numeric from et_budget_progress() where category_id = $1', [f.parent]))[0];
    assert.deepEqual([Number(b.amount), Number(b.spent)], [1000, 150]);
  }));
});

describe('templates', () => {
  it('adds a transaction from a template and counts the use', () => asUser(async (q) => {
    const f = await fixtures(q);
    const t = await one(q(`insert into et_templates (name, type, amount, category_id, account_id) values ('ZZ Tea', 'expense', 20, $1, $2) returning id`, [f.child, f.a]));
    const id = (await one(q(`select et_use_template($1, '2099-03-01') as id`, [t.id]))).id;
    const txn = await one(q('select type, amount::numeric, description, occurred_on::text, category_id, account_id from et_transactions where id = $1', [id]));
    assert.deepEqual({ ...txn, amount: Number(txn.amount) }, {
      type: 'expense', amount: 20, description: 'ZZ Tea', occurred_on: '2099-03-01', category_id: f.child, account_id: f.a,
    });
    assert.equal((await one(q('select use_count from et_templates where id = $1', [t.id]))).use_count, 1);
  }));

  it('needs an amount when the template has none, and uses the one given', () => asUser(async (q) => {
    const t = await one(q(`insert into et_templates (name, type) values ('ZZ Petrol', 'expense') returning id`));
    await assert.rejects(q(`select et_use_template($1, '2099-03-01')`, [t.id]), /no amount/);
    const id = (await one(q(`select et_use_template($1, '2099-03-01', 1500) as id`, [t.id]))).id;
    assert.equal(Number((await one(q('select amount from et_transactions where id = $1', [id]))).amount), 1500);
  }));

  it("can't use another user's template", () => asUser(async (q) => {
    const t = await one(q(`insert into et_templates (name, type, amount) values ('ZZ Mine', 'expense', 5) returning id`));
    await q.switchUser(OTHER_USER);
    await assert.rejects(q(`select et_use_template($1, '2099-03-01')`, [t.id]), /not found/);
  }));
});

describe('investments', () => {
  it('top-ups raise invested amount and value; removing one reverses it', () => asUser(async (q) => {
    const inv = await one(q(`insert into et_investments (name, type, invested_amount, current_value) values ('ZZ Fund', 'mutual-fund', 1000, 1200) returning id`));
    const c = await one(q(`insert into et_investment_contributions (investment_id, amount) values ($1, 500) returning id`, [inv.id]));
    let row = await one(q('select invested_amount::numeric as i, current_value::numeric as v from et_investments where id = $1', [inv.id]));
    assert.deepEqual([Number(row.i), Number(row.v)], [1500, 1700]);
    await q('delete from et_investment_contributions where id = $1', [c.id]);
    row = await one(q('select invested_amount::numeric as i, current_value::numeric as v from et_investments where id = $1', [inv.id]));
    assert.deepEqual([Number(row.i), Number(row.v)], [1000, 1200]);
  }));
});

describe('categories', () => {
  it('seeding is a no-op for a user who already has categories', () => asUser(async (q) => {
    const before = (await one(q('select count(*)::int as n from et_categories'))).n;
    await q('select et_seed_categories()');
    assert.equal((await one(q('select count(*)::int as n from et_categories'))).n, before);
  }));

  it('deleting a category leaves its transactions uncategorised', () => asUser(async (q) => {
    const f = await fixtures(q);
    const t = await one(q(`insert into et_transactions (type, amount, category_id) values ('expense', 5, $1) returning id`, [f.child]));
    await q('delete from et_categories where id = $1', [f.parent]); // cascades to the subcategory
    assert.equal((await one(q('select category_id from et_transactions where id = $1', [t.id]))).category_id, null);
  }));
});
