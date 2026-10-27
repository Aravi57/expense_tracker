import { defineConfig, devices } from '@playwright/test';

// End-to-end tests: the real app in Microsoft Edge (installed with Windows, so no
// browser download), talking to the in-memory Supabase stand-in in e2e/mock-supabase.ts.
const PORT = 5174;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  // Several Edge windows at once can slow a laptop down; allow a little longer than the default 5s
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}/expense_tracker/`,
    channel: process.env.CI ? undefined : 'msedge',
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
    // A service worker could fetch around the mocked Supabase routes, so keep it off in tests
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 860 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: process.env.CI ? undefined : 'msedge' } },
  ],
  // Test the production build, exactly as it will be deployed
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/expense_tracker/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
