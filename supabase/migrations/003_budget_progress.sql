-- Budgets with how much has been spent in their current period.
-- A budget on a category also counts spending in its subcategories.
create or replace function public.et_budget_progress()
returns table (id uuid, category_id uuid, amount numeric, period text, sort_order int, spent numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.id, b.category_id, b.amount, b.period, b.sort_order,
         coalesce((
           select sum(t.amount)
           from public.et_transactions t
           left join public.et_categories c on c.id = t.category_id
           where t.type = 'expense'
             and (t.category_id = b.category_id or c.parent_id = b.category_id)
             and t.occurred_on >= date_trunc(case b.period when 'weekly' then 'week'
                                                           when 'yearly' then 'year'
                                                           else 'month' end, current_date)::date
             and t.occurred_on <= current_date
         ), 0) as spent
  from public.et_budgets b
  order by b.sort_order, b.created_at;
$$;

revoke all on function public.et_budget_progress() from public, anon;
grant execute on function public.et_budget_progress() to authenticated;
