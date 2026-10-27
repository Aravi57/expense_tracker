import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Unit and component tests (src/**/*.test.ts[x]). End-to-end tests live in e2e/ (Playwright)
// and database tests in tests/db (run against Supabase).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
  },
});
