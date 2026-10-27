-- Templates: saved transactions you add with one tap (replacing scheduled recurring rules).
-- A template with an amount is added straight away; one without opens the form to fill it in.
create table if not exists public.et_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  type text not null check (type in ('expense', 'income', 'transfer')),
  amount numeric(14, 2) check (amount is null or amount > 0),
  description text not null default '',
  category_id uuid,
  account_id uuid,
  to_account_id uuid,
  sort_order int not null default 0,
  use_count int not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'transfer' or category_id is null),
  foreign key (category_id, user_id) references public.et_categories (id, user_id) on delete set null (category_id),
  foreign key (account_id, user_id) references public.et_accounts (id, user_id) on delete set null (account_id),
  foreign key (to_account_id, user_id) references public.et_accounts (id, user_id) on delete set null (to_account_id)
);

create index if not exists et_templates_user_idx on public.et_templates (user_id, sort_order);

drop trigger if exists touch_updated_at on public.et_templates;
create trigger touch_updated_at before update on public.et_templates
  for each row execute function public.et_touch_updated_at();

alter table public.et_templates enable row level security;
drop policy if exists "Users manage own rows" on public.et_templates;
create policy "Users manage own rows" on public.et_templates for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.et_templates from anon;
grant select, insert, update, delete on public.et_templates to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'et_templates') then
    alter publication supabase_realtime add table public.et_templates;
  end if;
end $$;

-- Add a transaction from a template in one call; returns the new transaction's id.
-- p_amount overrides the template's amount (needed when the template has none).
create or replace function public.et_use_template(p_template uuid, p_date date default current_date, p_amount numeric default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t public.et_templates%rowtype;
  new_id uuid;
begin
  select * into t from public.et_templates where id = p_template;
  if not found then
    raise exception 'Template not found';
  end if;
  if coalesce(p_amount, t.amount) is null then
    raise exception 'This template has no amount; enter one';
  end if;

  insert into public.et_transactions (user_id, type, amount, description, occurred_on, category_id, account_id, to_account_id)
  values (t.user_id, t.type, coalesce(p_amount, t.amount), coalesce(nullif(t.description, ''), t.name), p_date,
          case when t.type = 'transfer' then null else t.category_id end, t.account_id, t.to_account_id)
  returning id into new_id;

  update public.et_templates set use_count = use_count + 1, last_used_at = now() where id = t.id;
  return new_id;
end $$;

revoke all on function public.et_use_template(uuid, date, numeric) from public, anon;
grant execute on function public.et_use_template(uuid, date, numeric) to authenticated;
