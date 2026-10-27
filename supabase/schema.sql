-- Expense Tracker schema for Supabase.
-- Each table stores one app record per row: the record's fields live in `data`,
-- and `user_id` ties it to the signed-in Supabase Auth user. Row level security
-- lets each user read and write only their own rows.
-- Tables use the `et_` prefix because the database is shared with other projects.

do $$
declare
  t text;
begin
  foreach t in array array['et_transactions', 'et_accounts', 'et_budgets', 'et_recurring', 'et_investments']
  loop
    execute format($f$
      create table if not exists public.%1$I (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
        data jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )$f$, t);

    execute format('create index if not exists %1$I on public.%2$I (user_id)', t || '_user_id_idx', t);
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "Users manage own rows" on public.%I', t);
    execute format($f$
      create policy "Users manage own rows" on public.%I
        for all to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))$f$, t);

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    -- Realtime: lets other devices see changes as they happen.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
