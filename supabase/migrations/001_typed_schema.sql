-- Expense Tracker v2 schema: typed tables, per-user row level security,
-- and database functions that do the heavy aggregation server side.
-- All tables use the et_ prefix because the database is shared with other projects.
-- Safe to re-run: every statement is idempotent.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Keep the v1 JSON tables (renamed) until v2 is live, then drop them.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'transactions', 'budgets', 'recurring', 'investments']
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'et_' || t and column_name = 'data'
    ) then
      execute format('alter table public.%I rename to %I', 'et_' || t, 'et_legacy_' || t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------
create or replace function public.et_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- Foreign keys include user_id so a row can only point at the same user's rows.
-- ---------------------------------------------------------------------------
create table if not exists public.et_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id uuid,
  kind text not null check (kind in ('expense', 'income')),
  name text not null check (length(trim(name)) between 1 and 40),
  slug text,
  icon text not null default 'Tag',
  color text not null default '#94a3b8',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique nulls not distinct (user_id, kind, parent_id, name),
  foreign key (parent_id, user_id) references public.et_categories (id, user_id) on delete cascade
);

create table if not exists public.et_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  type text not null default 'bank' check (type in ('bank', 'cash', 'credit', 'wallet', 'investment', 'other')),
  opening_balance numeric(14, 2) not null default 0,
  color text,
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.et_investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  type text not null default 'other' check (type in (
    'stocks', 'mutual-fund', 'ppf', 'epf', 'silver', 'gold', 'real-estate',
    'bonds', 'crypto', 'fixed-deposit', 'other')),
  risk text not null default 'medium' check (risk in ('low', 'medium', 'high')),
  invested_amount numeric(14, 2) not null default 0 check (invested_amount >= 0),
  current_value numeric(14, 2) not null default 0 check (current_value >= 0),
  started_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.et_recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('expense', 'income', 'transfer')),
  amount numeric(14, 2) not null check (amount > 0),
  description text not null default '',
  category_id uuid,
  account_id uuid,
  to_account_id uuid,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  next_date date not null,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id) references public.et_categories (id, user_id) on delete set null (category_id),
  foreign key (account_id, user_id) references public.et_accounts (id, user_id) on delete set null (account_id),
  foreign key (to_account_id, user_id) references public.et_accounts (id, user_id) on delete set null (to_account_id)
);

create table if not exists public.et_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('expense', 'income', 'transfer')),
  amount numeric(14, 2) not null check (amount > 0),
  description text not null default '',
  notes text,
  occurred_on date not null default current_date,
  category_id uuid,
  account_id uuid,
  to_account_id uuid,
  recurring_id uuid,
  investment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'transfer' or category_id is null),
  foreign key (category_id, user_id) references public.et_categories (id, user_id) on delete set null (category_id),
  foreign key (account_id, user_id) references public.et_accounts (id, user_id) on delete set null (account_id),
  foreign key (to_account_id, user_id) references public.et_accounts (id, user_id) on delete set null (to_account_id),
  foreign key (recurring_id, user_id) references public.et_recurring (id, user_id) on delete set null (recurring_id),
  foreign key (investment_id, user_id) references public.et_investments (id, user_id) on delete set null (investment_id)
);

create table if not exists public.et_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0),
  period text not null default 'monthly' check (period in ('weekly', 'monthly', 'yearly')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, period),
  foreign key (category_id, user_id) references public.et_categories (id, user_id) on delete cascade
);

create table if not exists public.et_investment_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  investment_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0),
  contributed_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (investment_id, user_id) references public.et_investments (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Indexes for the app's common queries
-- ---------------------------------------------------------------------------
create index if not exists et_transactions_user_date_idx on public.et_transactions (user_id, occurred_on desc, created_at desc);
create index if not exists et_transactions_account_idx on public.et_transactions (account_id);
create index if not exists et_transactions_to_account_idx on public.et_transactions (to_account_id);
create index if not exists et_transactions_category_idx on public.et_transactions (category_id);
create index if not exists et_transactions_description_trgm_idx on public.et_transactions using gin (description extensions.gin_trgm_ops);
create index if not exists et_categories_user_idx on public.et_categories (user_id, kind, sort_order);
create index if not exists et_accounts_user_idx on public.et_accounts (user_id, sort_order);
create index if not exists et_budgets_user_idx on public.et_budgets (user_id, sort_order);
create index if not exists et_recurring_due_idx on public.et_recurring (user_id, next_date) where active;
create index if not exists et_investments_user_idx on public.et_investments (user_id);
create index if not exists et_contributions_investment_idx on public.et_investment_contributions (investment_id, contributed_on desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['et_accounts', 'et_investments', 'et_recurring', 'et_transactions', 'et_budgets']
  loop
    execute format('drop trigger if exists touch_updated_at on public.%I', t);
    execute format('create trigger touch_updated_at before update on public.%I
                    for each row execute function public.et_touch_updated_at()', t);
  end loop;
end $$;

-- A top-up adds to both the invested amount and the current value; deleting it reverses that.
create or replace function public.et_apply_contribution()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.et_investments
       set invested_amount = invested_amount + new.amount,
           current_value = current_value + new.amount
     where id = new.investment_id;
    return new;
  else
    update public.et_investments
       set invested_amount = greatest(invested_amount - old.amount, 0),
           current_value = greatest(current_value - old.amount, 0)
     where id = old.investment_id;
    return old;
  end if;
end $$;

drop trigger if exists apply_contribution on public.et_investment_contributions;
create trigger apply_contribution after insert or delete on public.et_investment_contributions
  for each row execute function public.et_apply_contribution();

-- ---------------------------------------------------------------------------
-- Row level security: each user can only see and change their own rows
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['et_categories', 'et_accounts', 'et_investments', 'et_recurring',
                           'et_transactions', 'et_budgets', 'et_investment_contributions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Users manage own rows" on public.%I', t);
    execute format('create policy "Users manage own rows" on public.%I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Account balances: opening balance plus every transaction that touches the account
-- ---------------------------------------------------------------------------
create or replace view public.et_account_balances
with (security_invoker = true) as
select
  a.*,
  a.opening_balance + coalesce((
    select sum(case
                 when t.account_id = a.id and t.type = 'income' then t.amount
                 when t.account_id = a.id then -t.amount
                 when t.to_account_id = a.id and t.type = 'transfer' then t.amount
                 else 0
               end)
    from public.et_transactions t
    where t.account_id = a.id or t.to_account_id = a.id
  ), 0) as balance
from public.et_accounts a;

revoke all on public.et_account_balances from anon;
grant select on public.et_account_balances to authenticated;

-- ---------------------------------------------------------------------------
-- API functions (run with the caller's permissions, so RLS applies)
-- ---------------------------------------------------------------------------

-- Totals and spending patterns for a date range
create or replace function public.et_summary(p_from date, p_to date)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  select json_build_object(
    'income', coalesce(sum(amount) filter (where type = 'income'), 0),
    'expense', coalesce(sum(amount) filter (where type = 'expense'), 0),
    'count', count(*),
    'expense_count', count(*) filter (where type = 'expense'),
    'weekend_expense', coalesce(sum(amount) filter (where type = 'expense' and extract(isodow from occurred_on) >= 6), 0),
    'largest_expense', coalesce(max(amount) filter (where type = 'expense'), 0)
  )
  from public.et_transactions
  where occurred_on between p_from and p_to;
$$;

-- Income and expense per month for the last p_months months up to p_until
create or replace function public.et_monthly_totals(p_until date default current_date, p_months int default 12)
returns table (month date, income numeric, expense numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select generate_series(
      date_trunc('month', p_until) - make_interval(months => greatest(p_months, 1) - 1),
      date_trunc('month', p_until),
      interval '1 month'
    )::date as month
  )
  select m.month,
         coalesce(sum(t.amount) filter (where t.type = 'income'), 0) as income,
         coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as expense
  from months m
  left join public.et_transactions t
    on t.occurred_on >= m.month and t.occurred_on < (m.month + interval '1 month')
  group by m.month
  order by m.month;
$$;

-- Totals per top-level category (subcategories roll up into their parent)
create or replace function public.et_category_totals(p_from date, p_to date, p_type text default 'expense')
returns table (category_id uuid, name text, icon text, color text, total numeric, count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(p.id, c.id) as category_id,
         coalesce(p.name, c.name, 'Uncategorised') as name,
         coalesce(p.icon, c.icon, 'Tag') as icon,
         coalesce(p.color, c.color, '#94a3b8') as color,
         sum(t.amount) as total,
         count(*) as count
  from public.et_transactions t
  left join public.et_categories c on c.id = t.category_id
  left join public.et_categories p on p.id = c.parent_id
  where t.type = p_type and t.occurred_on between p_from and p_to
  group by 1, 2, 3, 4
  order by total desc;
$$;

-- Total of all account balances at the start of a day
create or replace function public.et_balance_at(p_date date)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select sum(opening_balance) from public.et_accounts), 0)
       + coalesce((select sum(case when type = 'income' then amount else -amount end)
                   from public.et_transactions
                   where occurred_on < p_date and type in ('income', 'expense')), 0);
$$;

-- Create transactions for every recurring rule that is due, and move each rule forward.
-- Locks the rules so two devices opening the app at once can't create duplicates.
create or replace function public.et_process_recurring()
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.et_recurring%rowtype;
  step interval;
  created int := 0;
begin
  for r in
    select * from public.et_recurring
    where active and next_date <= current_date
    for update skip locked
  loop
    step := case r.frequency
              when 'daily' then interval '1 day'
              when 'weekly' then interval '1 week'
              when 'monthly' then interval '1 month'
              when 'quarterly' then interval '3 months'
              else interval '1 year'
            end;

    while r.next_date <= current_date and (r.end_date is null or r.next_date <= r.end_date) loop
      insert into public.et_transactions (user_id, type, amount, description, occurred_on,
                                          category_id, account_id, to_account_id, recurring_id)
      values (r.user_id, r.type, r.amount, r.description, r.next_date,
              case when r.type = 'transfer' then null else r.category_id end,
              r.account_id, r.to_account_id, r.id);
      created := created + 1;
      r.next_date := (r.next_date + step)::date;
    end loop;

    update public.et_recurring
       set next_date = r.next_date,
           active = r.end_date is null or r.next_date <= r.end_date
     where id = r.id;
  end loop;

  return created;
end $$;

-- Give a user the default categories (only if they have none yet)
create or replace function public.et_seed_categories(p_user uuid default auth.uid())
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cat record;
  parent uuid;
  sub text;
  i int := 0;
  j int;
begin
  if p_user is null or exists (select 1 from public.et_categories where user_id = p_user) then
    return;
  end if;

  for cat in
    select * from (values
      ('expense', 'home',         'Home',                'House',           '#f97316', array['Rent', 'EB', 'Other']),
      ('expense', 'food',         'Food',                'UtensilsCrossed', '#ef4444', array['Food', 'Other']),
      ('expense', 'grocery',      'Grocery',             'ShoppingCart',    '#22c55e', array['Nuts', 'Nonveg', 'Other']),
      ('expense', 'transport',    'Transport',           'Car',             '#3b82f6', array['Fuel', 'Service', 'Other']),
      ('expense', 'shopping',     'Shopping',            'ShoppingBag',     '#ec4899', array['Shopping', 'Other']),
      ('expense', 'subscription', 'Subscription',        'Smartphone',      '#8b5cf6', array['Mobile', 'Wifi', 'Other']),
      ('expense', 'snacks',       'Snacks',              'Cookie',          '#eab308', array['Snacks', 'Other']),
      ('expense', 'health',       'Health and Wellness', 'HeartPulse',      '#14b8a6', array['Badminton', 'Grooming', 'Other']),
      ('expense', 'investment',   'Investment',          'TrendingUp',      '#6366f1', array['PPF', 'MF', 'LIC', 'Other']),
      ('expense', 'emi',          'EMI',                 'CreditCard',      '#64748b', array['EMI', 'Other']),
      ('expense', 'other',        'Other',               'Package',         '#94a3b8', array['Other']),
      ('income',  'salary',       'Salary',              'Briefcase',       '#10b981', array['Salary', 'Other']),
      ('income',  'other',        'Other income',        'Coins',           '#84cc16', array['Other'])
    ) as v(kind, slug, name, icon, color, subs)
  loop
    i := i + 1;
    insert into public.et_categories (user_id, kind, slug, name, icon, color, sort_order)
    values (p_user, cat.kind, cat.slug, cat.name, cat.icon, cat.color, i)
    returning id into parent;

    j := 0;
    foreach sub in array cat.subs loop
      j := j + 1;
      insert into public.et_categories (user_id, parent_id, kind, slug, name, icon, color, sort_order)
      values (p_user, parent, cat.kind, cat.slug || '-' || lower(sub), sub, cat.icon, cat.color, j);
    end loop;
  end loop;
end $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'et_summary(date, date)', 'et_monthly_totals(date, int)', 'et_category_totals(date, date, text)',
    'et_balance_at(date)', 'et_process_recurring()', 'et_seed_categories(uuid)'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
