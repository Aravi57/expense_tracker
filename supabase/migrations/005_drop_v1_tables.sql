-- v2 is live and all v1 rows were copied by 002_migrate_v1_data.sql, so the
-- renamed v1 JSON tables are no longer needed. (002 skips itself once they're gone.)
drop table if exists public.et_legacy_transactions;
drop table if exists public.et_legacy_accounts;
drop table if exists public.et_legacy_budgets;
drop table if exists public.et_legacy_recurring;
drop table if exists public.et_legacy_investments;
