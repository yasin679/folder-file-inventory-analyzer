import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  reporter: [['list'], ['html', { outputFolder: 'test-reports/e2e-html', open: 'never' }]],
  use: { baseURL: 'http://localhost:4173', acceptDownloads: true, viewport: { width: 1400, height: 900 } },
  webServer: { command: 'npx vite build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', timeout: 120_000, reuseExistingServer: false },
});
