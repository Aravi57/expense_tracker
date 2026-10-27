-- Copy v1 records (JSON rows in et_legacy_*) into the v2 typed tables.
-- v1 stored categories as slugs like 'home-rent'; they map onto the seeded
-- categories' slug column. Safe to re-run: rows keep their v1 ids and
-- already-copied rows are skipped.

do $$
declare
  u uuid;
begin
  if to_regclass('public.et_legacy_transactions') is null then
    return;
  end if;

  -- Seed default categories for every user that has v1 data
  for u in
    select user_id from public.et_legacy_accounts
    union select user_id from public.et_legacy_transactions
    union select user_id from public.et_legacy_budgets
    union select user_id from public.et_legacy_investments
    union select user_id from public.et_legacy_recurring
  loop
    perform public.et_seed_categories(u);
  end loop;

  -- Accounts: v1 kept a running balance, v2 derives it from transactions,
  -- so the opening balance is the v1 balance with the account's v1 transactions undone.
  insert into public.et_accounts (id, user_id, name, type, opening_balance, created_at)
  select a.id, a.user_id,
         left(coalesce(nullif(trim(a.data->>'name'), ''), 'Account'), 40),
         case when a.data->>'type' in ('bank', 'cash', 'credit', 'wallet', 'investment', 'other')
              then a.data->>'type' else 'other' end,
         coalesce((a.data->>'balance')::numeric, 0) - coalesce((
           select sum(case
                        when t.data->>'account' = a.id::text and t.data->>'type' = 'income' then (t.data->>'amount')::numeric
                        when t.data->>'account' = a.id::text then -(t.data->>'amount')::numeric
                        when t.data->>'toAccount' = a.id::text then (t.data->>'amount')::numeric
                        else 0
                      end)
           from public.et_legacy_transactions t
           where t.user_id = a.user_id
             and (t.data->>'account' = a.id::text or t.data->>'toAccount' = a.id::text)
         ), 0),
         a.created_at
  from public.et_legacy_accounts a
  on conflict (id) do nothing;

  insert into public.et_transactions (id, user_id, type, amount, description, occurred_on,
                                      category_id, account_id, to_account_id, created_at)
  select t.id, t.user_id, t.data->>'type', (t.data->>'amount')::numeric,
         coalesce(t.data->>'description', ''),
         coalesce((t.data->>'date')::date, t.created_at::date),
         case when t.data->>'type' = 'transfer' then null else (
           select c.id from public.et_categories c
           where c.user_id = t.user_id
             and c.kind = case when t.data->>'type' = 'income' then 'income' else 'expense' end
             and c.slug in (t.data->>'category', t.data->>'category' || '-other')
           order by (c.slug = t.data->>'category') desc
           limit 1) end,
         (select id from public.et_accounts where id::text = t.data->>'account' and user_id = t.user_id),
         (select id from public.et_accounts where id::text = t.data->>'toAccount' and user_id = t.user_id),
         t.created_at
  from public.et_legacy_transactions t
  where t.data->>'type' in ('expense', 'income', 'transfer')
    and (t.data->>'amount')::numeric > 0
  on conflict (id) do nothing;

  insert into public.et_budgets (id, user_id, category_id, amount, period, sort_order, created_at)
  select b.id, b.user_id, c.id, (b.data->>'amount')::numeric,
         coalesce(b.data->>'period', 'monthly'), coalesce((b.data->>'order')::int, 0), b.created_at
  from public.et_legacy_budgets b
  join public.et_categories c on c.user_id = b.user_id and c.kind = 'expense' and c.slug = b.data->>'category'
  where (b.data->>'amount')::numeric > 0
  on conflict do nothing;

  insert into public.et_investments (id, user_id, name, type, risk, invested_amount, current_value,
                                     started_on, notes, created_at)
  select i.id, i.user_id, left(coalesce(nullif(trim(i.data->>'name'), ''), 'Investment'), 60),
         case when i.data->>'type' in ('stocks', 'mutual-fund', 'ppf', 'epf', 'silver', 'gold', 'real-estate',
                                      'bonds', 'crypto', 'fixed-deposit', 'other')
              then i.data->>'type' else 'other' end,
         case when i.data->>'risk' in ('low', 'medium', 'high') then i.data->>'risk' else 'medium' end,
         coalesce((i.data->>'amount')::numeric, 0),
         coalesce((i.data->>'currentValue')::numeric, (i.data->>'amount')::numeric, 0),
         coalesce((i.data->>'date')::date, i.created_at::date),
         nullif(i.data->>'description', ''),
         i.created_at
  from public.et_legacy_investments i
  on conflict (id) do nothing;
end $$;
