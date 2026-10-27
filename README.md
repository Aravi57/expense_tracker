# Expense Tracker

Track spending, budgets, recurring bills and investments, in sync across devices.
Live at **https://aravi57.github.io/expense_tracker/**.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS · TanStack Query · Recharts · Supabase (Postgres, Auth, Realtime) · installable PWA

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/expense_tracker/
```

## Test

| Command | What it runs |
| --- | --- |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:e2e` | End-to-end tests in a real browser against an in-memory Supabase stand-in (`e2e/mock-supabase.ts`) |
| `npm run test:db` | Database tests against Supabase (needs `DATABASE_URL`); every test is rolled back |
| `npm run test:all` | All of the above plus the type-check |

## Database

Schema, row level security and API functions live in `supabase/migrations`, applied in order.
Every table is prefixed `et_` because the Supabase project is shared with other apps.

## Deploy

Pushing to `main` runs the type-check, unit and end-to-end tests, then builds and publishes
to GitHub Pages (`.github/workflows/deploy.yml`).
