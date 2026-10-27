// An in-memory stand-in for the Supabase project, used by the end-to-end tests.
// It answers the same HTTP calls supabase-js makes (auth, PostgREST tables and the
// et_* functions) and mirrors the database behaviour in supabase/migrations:
// per-user rows, computed balances, cascades, budgets, recurring catch-up and so on.
// Nothing is ever sent to the real Supabase.

import type { BrowserContext, Route } from '@playwright/test';

export const SUPABASE_HOST = 'kuwuqcctqcldbwblbnfs.supabase.co';
export const STORAGE_KEY = 'sb-kuwuqcctqcldbwblbnfs-auth-token';

type Row = Record<string, any>;

interface User {
  id: string;
  email: string;
  password: string;
  meta: Record<string, string>;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoDate(new Date());
const parseDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const uuid = () => crypto.randomUUID();
const num = (v: unknown) => Number(v ?? 0);

const DEFAULTS: Record<string, () => Row> = {
  et_categories: () => ({ parent_id: null, slug: null, icon: 'Tag', color: '#94a3b8', sort_order: 0 }),
  et_accounts: () => ({ type: 'bank', opening_balance: 0, color: null, sort_order: 0, archived: false }),
  et_transactions: () => ({
    description: '', notes: null, occurred_on: today(), category_id: null, account_id: null,
    to_account_id: null, recurring_id: null, investment_id: null,
  }),
  et_budgets: () => ({ period: 'monthly', sort_order: 0 }),
  et_recurring: () => ({ description: '', category_id: null, account_id: null, to_account_id: null, end_date: null, active: true }),
  et_investments: () => ({ risk: 'medium', type: 'other', invested_amount: 0, current_value: 0, started_on: today(), notes: null }),
  et_investment_contributions: () => ({ contributed_on: today(), notes: null }),
};

const SEED: [string, string, string, string, string, string[]][] = [
  ['expense', 'home', 'Home', 'House', '#f97316', ['Rent', 'EB', 'Other']],
  ['expense', 'food', 'Food', 'UtensilsCrossed', '#ef4444', ['Food', 'Other']],
  ['expense', 'grocery', 'Grocery', 'ShoppingCart', '#22c55e', ['Nuts', 'Nonveg', 'Other']],
  ['expense', 'transport', 'Transport', 'Car', '#3b82f6', ['Fuel', 'Service', 'Other']],
  ['expense', 'shopping', 'Shopping', 'ShoppingBag', '#ec4899', ['Shopping', 'Other']],
  ['expense', 'investment', 'Investment', 'TrendingUp', '#6366f1', ['PPF', 'MF', 'LIC', 'Other']],
  ['expense', 'other', 'Other', 'Package', '#94a3b8', ['Other']],
  ['income', 'salary', 'Salary', 'Briefcase', '#10b981', ['Salary', 'Other']],
  ['income', 'other', 'Other income', 'Coins', '#84cc16', ['Other']],
];

function fakeJwt(sub: string) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

export class MockSupabase {
  users: User[] = [];
  tables: Record<string, Row[]> = Object.fromEntries(Object.keys(DEFAULTS).map((t) => [t, []]));
  /** Requests the mock didn't understand; tests assert this stays empty */
  unhandled: string[] = [];
  /** Requests that tried to leave the machine and were blocked */
  blocked: string[] = [];

  addUser(username: string, password: string, fullname: string) {
    const user: User = { id: uuid(), email: `${username.toLowerCase()}@expense-tracker.invalid`, password, meta: { username, fullname } };
    this.users.push(user);
    return user;
  }

  authUser(u: User) {
    return {
      id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, user_metadata: u.meta,
      app_metadata: { provider: 'email' }, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    };
  }

  session(u: User) {
    return {
      access_token: fakeJwt(u.id), token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `refresh-${u.id}`, user: this.authUser(u),
    };
  }

  /** Rows of a table that belong to a user (what RLS would let them see) */
  rows(table: string, userId: string) {
    return this.tables[table].filter((r) => r.user_id === userId);
  }

  // ---------------------------------------------------------------- routing

  async install(context: BrowserContext) {
    // Block anything that isn't the local dev server or the mocked Supabase
    await context.route((url) => !['localhost', '127.0.0.1', SUPABASE_HOST].includes(url.hostname), (route) => {
      this.blocked.push(route.request().url());
      return route.abort();
    });
    await context.route(`https://${SUPABASE_HOST}/**`, (route) => this.handle(route));
    // Realtime: accept the socket but stay silent (no server behind it)
    await context.routeWebSocket(new RegExp(`${SUPABASE_HOST.replace(/\./g, '\\.')}/realtime`), () => {});
  }

  private userFrom(route: Route) {
    const auth = route.request().headers()['authorization'] ?? '';
    const token = auth.replace(/^Bearer\s+/i, '');
    try {
      const sub = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
      return this.users.find((u) => u.id === sub);
    } catch {
      return undefined;
    }
  }

  private json(route: Route, status: number, body?: unknown) {
    return route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': '*' },
      body: body === undefined ? '' : JSON.stringify(body),
    });
  }

  private async handle(route: Route) {
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    }
    const url = new URL(req.url());
    try {
      if (url.pathname.startsWith('/auth/v1/')) return await this.auth(route, url);
      if (url.pathname.startsWith('/rest/v1/rpc/')) return await this.rpc(route, url.pathname.slice('/rest/v1/rpc/'.length));
      if (url.pathname.startsWith('/rest/v1/')) return await this.rest(route, url.pathname.slice('/rest/v1/'.length), url);
    } catch (e) {
      this.unhandled.push(`${req.method()} ${url.pathname}: ${(e as Error).message}`);
      return this.json(route, 500, { message: (e as Error).message });
    }
    this.unhandled.push(`${req.method()} ${url.pathname}`);
    return this.json(route, 404, { message: 'not mocked' });
  }

  // ---------------------------------------------------------------- auth

  private async auth(route: Route, url: URL) {
    const req = route.request();
    const path = url.pathname.slice('/auth/v1/'.length);
    const body = req.postData() ? JSON.parse(req.postData()!) : {};

    if (path === 'token' && url.searchParams.get('grant_type') === 'password') {
      const u = this.users.find((x) => x.email === body.email && x.password === body.password);
      if (!u) return this.json(route, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return this.json(route, 200, this.session(u));
    }
    if (path === 'token' && url.searchParams.get('grant_type') === 'refresh_token') {
      const u = this.users.find((x) => `refresh-${x.id}` === body.refresh_token);
      return u ? this.json(route, 200, this.session(u)) : this.json(route, 400, { msg: 'Invalid refresh token' });
    }
    if (path === 'signup') {
      if (this.users.some((x) => x.email === body.email)) {
        return this.json(route, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      }
      const u: User = { id: uuid(), email: body.email, password: body.password, meta: body.data ?? {} };
      this.users.push(u);
      return this.json(route, 200, this.session(u));
    }
    const user = this.userFrom(route);
    if (path === 'user' && req.method() === 'GET') return user ? this.json(route, 200, this.authUser(user)) : this.json(route, 401, { msg: 'no user' });
    if (path === 'user' && req.method() === 'PUT' && user) {
      if (body.data) user.meta = { ...user.meta, ...body.data };
      if (body.password) user.password = body.password;
      return this.json(route, 200, this.authUser(user));
    }
    if (path === 'logout') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    throw new Error(`auth ${req.method()} ${path}`);
  }

  // ---------------------------------------------------------------- tables

  private filter(rows: Row[], params: URLSearchParams) {
    const test = (row: Row, col: string, expr: string): boolean => {
      const dot = expr.indexOf('.');
      const op = expr.slice(0, dot);
      const val = expr.slice(dot + 1);
      const v = row[col];
      switch (op) {
        case 'eq': return String(v) === val;
        case 'neq': return String(v) !== val;
        case 'gte': return String(v) >= val;
        case 'lte': return String(v) <= val;
        case 'gt': return String(v) > val;
        case 'lt': return String(v) < val;
        case 'is': return val === 'null' ? v == null : String(v) === val;
        case 'in': return val.slice(1, -1).split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(v));
        case 'ilike': {
          const re = new RegExp(`^${val.replace(/[.*+?^${}()|[\]\\]/g, (c) => (c === '*' ? '.*' : `\\${c}`)).replace(/%/g, '.*')}$`, 'i');
          return re.test(String(v ?? ''));
        }
        default: throw new Error(`filter op ${op}`);
      }
    };
    let out = rows;
    for (const [key, expr] of params) {
      if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(key)) continue;
      if (key === 'or') {
        const parts = expr.slice(1, -1).split(',');
        out = out.filter((r) => parts.some((p) => {
          const i = p.indexOf('.');
          return test(r, p.slice(0, i), p.slice(i + 1));
        }));
        continue;
      }
      out = out.filter((r) => test(r, key, expr));
    }
    return out;
  }

  private sort(rows: Row[], order: string | null) {
    if (!order) return rows;
    const keys = order.split(',').map((o) => {
      const [col, dir] = o.split('.');
      return { col, sign: dir === 'desc' ? -1 : 1 };
    });
    return [...rows].sort((a, b) => {
      for (const { col, sign } of keys) {
        const x = a[col];
        const y = b[col];
        if (x === y) continue;
        if (x == null) return 1;
        if (y == null) return -1;
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x) < String(y) ? -1 : 1) * sign;
      }
      return 0;
    });
  }

  private accountBalances(userId: string) {
    const txns = this.rows('et_transactions', userId);
    return this.rows('et_accounts', userId).map((a) => ({
      ...a,
      balance: txns.reduce((s, t) => {
        if (t.account_id === a.id) return s + (t.type === 'income' ? t.amount : -t.amount);
        if (t.to_account_id === a.id && t.type === 'transfer') return s + t.amount;
        return s;
      }, num(a.opening_balance)),
    }));
  }

  private check(table: string, row: Row, userId: string) {
    if ('amount' in row && !(num(row.amount) > 0)) return { status: 400, body: { code: '23514', message: 'violates check constraint' } };
    if (table === 'et_transactions' && row.type === 'transfer' && row.category_id) return { status: 400, body: { code: '23514', message: 'violates check constraint' } };
    if (table === 'et_budgets') {
      const dup = this.rows('et_budgets', userId).some((b) => b.id !== row.id && b.category_id === row.category_id && b.period === row.period);
      if (dup) return { status: 409, body: { code: '23505', message: 'duplicate key value violates unique constraint' } };
    }
    return null;
  }

  private respond(route: Route, rows: Row[], status = 200) {
    const req = route.request();
    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const prefer = req.headers()['prefer'] ?? '';
    if (req.method() !== 'GET' && !prefer.includes('return=representation')) return route.fulfill({ status: status === 200 ? 204 : status, headers: { 'access-control-allow-origin': '*' } });
    if (wantsObject) {
      if (rows.length !== 1) return this.json(route, 406, { code: 'PGRST116', message: `JSON object requested, ${rows.length} rows returned` });
      return this.json(route, status, rows[0]);
    }
    return this.json(route, status, rows);
  }

  private async rest(route: Route, table: string, url: URL) {
    const req = route.request();
    const user = this.userFrom(route);
    if (!user) return this.json(route, 401, { code: '42501', message: 'permission denied' });
    const params = url.searchParams;

    if (table === 'et_account_balances') {
      if (req.method() !== 'GET') throw new Error('view is read-only');
      return this.respond(route, this.sort(this.filter(this.accountBalances(user.id), params), params.get('order')));
    }
    if (!(table in this.tables)) throw new Error(`table ${table}`);
    const mine = () => this.rows(table, user.id);

    if (req.method() === 'GET') {
      let rows = this.sort(this.filter(mine(), params), params.get('order'));
      const offset = Number(params.get('offset') ?? 0);
      const limit = params.get('limit');
      rows = rows.slice(offset, limit ? offset + Number(limit) : undefined);
      return this.respond(route, rows);
    }

    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() ?? '{}');
      const inserted: Row[] = [];
      for (const input of Array.isArray(body) ? body : [body]) {
        const now = new Date().toISOString();
        const row = { id: uuid(), created_at: now, updated_at: now, ...DEFAULTS[table](), ...input, user_id: user.id };
        for (const k of ['amount', 'opening_balance', 'invested_amount', 'current_value']) if (k in row) row[k] = num(row[k]);
        const err = this.check(table, row, user.id);
        if (err) return this.json(route, err.status, err.body);
        this.tables[table].push(row);
        inserted.push(row);
        if (table === 'et_investment_contributions') this.applyContribution(row, 1);
      }
      return this.respond(route, inserted, 201);
    }

    if (req.method() === 'PATCH') {
      const patch = JSON.parse(req.postData() ?? '{}');
      const rows = this.filter(mine(), params);
      for (const row of rows) {
        const next = { ...row, ...patch, updated_at: new Date().toISOString() };
        for (const k of ['amount', 'opening_balance', 'invested_amount', 'current_value']) if (k in patch) next[k] = num(next[k]);
        const err = this.check(table, next, user.id);
        if (err) return this.json(route, err.status, err.body);
        Object.assign(row, next);
      }
      return this.respond(route, rows);
    }

    if (req.method() === 'DELETE') {
      const rows = this.filter(mine(), params);
      for (const row of rows) this.remove(table, row);
      return this.respond(route, rows);
    }
    throw new Error(`method ${req.method()}`);
  }

  // Delete a row with the same cascades / set-nulls as the real foreign keys
  private remove(table: string, row: Row) {
    this.tables[table] = this.tables[table].filter((r) => r !== row);
    const setNull = (t: string, col: string) => this.tables[t].forEach((r) => { if (r[col] === row.id) r[col] = null; });
    if (table === 'et_accounts') {
      for (const t of ['et_transactions', 'et_recurring']) { setNull(t, 'account_id'); setNull(t, 'to_account_id'); }
    }
    if (table === 'et_categories') {
      this.tables.et_categories.filter((c) => c.parent_id === row.id).forEach((c) => this.remove('et_categories', c));
      this.tables.et_budgets = this.tables.et_budgets.filter((b) => b.category_id !== row.id);
      setNull('et_transactions', 'category_id');
      setNull('et_recurring', 'category_id');
    }
    if (table === 'et_investments') {
      this.tables.et_investment_contributions = this.tables.et_investment_contributions.filter((c) => c.investment_id !== row.id);
      setNull('et_transactions', 'investment_id');
    }
    if (table === 'et_recurring') setNull('et_transactions', 'recurring_id');
    if (table === 'et_investment_contributions') this.applyContribution(row, -1);
  }

  private applyContribution(c: Row, sign: 1 | -1) {
    const inv = this.tables.et_investments.find((i) => i.id === c.investment_id);
    if (!inv) return;
    inv.invested_amount = Math.max(num(inv.invested_amount) + sign * num(c.amount), 0);
    inv.current_value = Math.max(num(inv.current_value) + sign * num(c.amount), 0);
  }

  // ---------------------------------------------------------------- functions

  private async rpc(route: Route, fn: string) {
    const user = this.userFrom(route);
    if (!user) return this.json(route, 401, { code: '42501', message: 'permission denied' });
    const args = JSON.parse(route.request().postData() || '{}');
    const txns = this.rows('et_transactions', user.id);
    const cats = this.rows('et_categories', user.id);
    const inRange = (t: Row) => t.occurred_on >= args.p_from && t.occurred_on <= args.p_to;

    switch (fn) {
      case 'et_seed_categories': {
        if (cats.length === 0) {
          SEED.forEach(([kind, slug, name, icon, color, subs], i) => {
            const parent = { id: uuid(), user_id: user.id, parent_id: null, kind, slug, name, icon, color, sort_order: i + 1, created_at: new Date().toISOString() };
            this.tables.et_categories.push(parent);
            subs.forEach((s, j) => this.tables.et_categories.push({
              id: uuid(), user_id: user.id, parent_id: parent.id, kind, slug: `${slug}-${s.toLowerCase()}`, name: s, icon, color, sort_order: j + 1, created_at: new Date().toISOString(),
            }));
          });
        }
        return this.json(route, 200, null);
      }
      case 'et_summary': {
        const rows = txns.filter(inRange);
        const exp = rows.filter((t) => t.type === 'expense');
        const sum = (list: Row[]) => list.reduce((s, t) => s + t.amount, 0);
        return this.json(route, 200, {
          income: sum(rows.filter((t) => t.type === 'income')),
          expense: sum(exp),
          count: rows.length,
          expense_count: exp.length,
          weekend_expense: sum(exp.filter((t) => [0, 6].includes(parseDate(t.occurred_on).getDay()))),
          largest_expense: exp.reduce((m, t) => Math.max(m, t.amount), 0),
        });
      }
      case 'et_monthly_totals': {
        const until = parseDate(args.p_until);
        const out = [];
        for (let i = (args.p_months ?? 12) - 1; i >= 0; i--) {
          const m = new Date(until.getFullYear(), until.getMonth() - i, 1);
          const key = isoDate(m).slice(0, 7);
          const rows = txns.filter((t) => t.occurred_on.startsWith(key));
          out.push({
            month: `${key}-01`,
            income: rows.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
            expense: rows.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
          });
        }
        return this.json(route, 200, out);
      }
      case 'et_category_totals': {
        const groups = new Map<string, Row>();
        for (const t of txns.filter((x) => x.type === (args.p_type ?? 'expense') && inRange(x))) {
          const c = cats.find((x) => x.id === t.category_id);
          const p = c?.parent_id ? cats.find((x) => x.id === c.parent_id) : c;
          const key = p?.id ?? 'none';
          const g = groups.get(key) ?? { category_id: p?.id ?? null, name: p?.name ?? 'Uncategorised', icon: p?.icon ?? 'Tag', color: p?.color ?? '#94a3b8', total: 0, count: 0 };
          g.total += t.amount;
          g.count += 1;
          groups.set(key, g);
        }
        return this.json(route, 200, [...groups.values()].sort((a, b) => b.total - a.total));
      }
      case 'et_balance_at': {
        const opening = this.rows('et_accounts', user.id).reduce((s, a) => s + num(a.opening_balance), 0);
        const flows = txns.filter((t) => t.occurred_on < args.p_date && t.type !== 'transfer')
          .reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
        return this.json(route, 200, opening + flows);
      }
      case 'et_budget_progress': {
        const now = new Date();
        const start = (period: string) => isoDate(period === 'weekly'
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
          : period === 'yearly' ? new Date(now.getFullYear(), 0, 1) : new Date(now.getFullYear(), now.getMonth(), 1));
        const budgets = this.sort(this.rows('et_budgets', user.id), 'sort_order.asc,created_at.asc');
        return this.json(route, 200, budgets.map((b) => ({
          id: b.id, category_id: b.category_id, amount: b.amount, period: b.period, sort_order: b.sort_order,
          spent: txns.filter((t) => {
            const c = cats.find((x) => x.id === t.category_id);
            return t.type === 'expense' && (t.category_id === b.category_id || c?.parent_id === b.category_id)
              && t.occurred_on >= start(b.period) && t.occurred_on <= today();
          }).reduce((s, t) => s + t.amount, 0),
        })));
      }
      case 'et_process_recurring': {
        const runUntil = args.p_today ?? today();
        let created = 0;
        for (const r of this.rows('et_recurring', user.id).filter((x) => x.active && x.next_date <= runUntil)) {
          while (r.next_date <= runUntil && (!r.end_date || r.next_date <= r.end_date)) {
            const now = new Date().toISOString();
            this.tables.et_transactions.push({
              ...DEFAULTS.et_transactions(), id: uuid(), user_id: user.id, created_at: now, updated_at: now,
              type: r.type, amount: r.amount, description: r.description, occurred_on: r.next_date,
              category_id: r.type === 'transfer' ? null : r.category_id, account_id: r.account_id,
              to_account_id: r.to_account_id, recurring_id: r.id,
            });
            created += 1;
            const d = parseDate(r.next_date);
            const step: Record<string, () => void> = {
              daily: () => d.setDate(d.getDate() + 1), weekly: () => d.setDate(d.getDate() + 7),
              monthly: () => d.setMonth(d.getMonth() + 1), quarterly: () => d.setMonth(d.getMonth() + 3),
              yearly: () => d.setFullYear(d.getFullYear() + 1),
            };
            step[r.frequency]();
            r.next_date = isoDate(d);
          }
          r.active = !r.end_date || r.next_date <= r.end_date;
        }
        return this.json(route, 200, created);
      }
    }
    throw new Error(`rpc ${fn}`);
  }
}
