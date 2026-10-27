-- Process recurring rules against the user's local date (the database clock is UTC,
-- so just after midnight in India it would still be "yesterday").
drop function if exists public.et_process_recurring();

create or replace function public.et_process_recurring(p_today date default current_date)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.et_recurring%rowtype;
  step interval;
  created int := 0;
  -- Never run more than a day ahead of the server clock
  run_until date := least(p_today, current_date + 1);
begin
  for r in
    select * from public.et_recurring
    where active and next_date <= run_until
    for update skip locked
  loop
    step := case r.frequency
              when 'daily' then interval '1 day'
              when 'weekly' then interval '1 week'
              when 'monthly' then interval '1 month'
              when 'quarterly' then interval '3 months'
              else interval '1 year'
            end;

    while r.next_date <= run_until and (r.end_date is null or r.next_date <= r.end_date) loop
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

revoke all on function public.et_process_recurring(date) from public, anon;
grant execute on function public.et_process_recurring(date) to authenticated;
