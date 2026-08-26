import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.spec.mjs',

  // Each spec launches its own persistent Chromium with the extension loaded,
  // so there is no shared browser to parallelise against cheaply.
  workers: 1,
  fullyParallel: false,

  timeout: 30_000,
  expect: { timeout: 5_000 },

  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
});
