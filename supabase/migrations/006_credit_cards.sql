-- Credit cards: an optional credit limit on accounts.
-- A card's balance is negative while money is owed. Spending on the card is an
-- expense from it; paying the bill is a transfer from a bank account to the card.
alter table public.et_accounts
  add column if not exists credit_limit numeric(14, 2) check (credit_limit is null or credit_limit > 0);

-- Views built with a.* keep the column list they were created with, so rebuild it
drop view if exists public.et_account_balances;
create view public.et_account_balances
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
