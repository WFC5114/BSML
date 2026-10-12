import { defineConfig, devices } from '@playwright/test';

// QA_BASE_URL: test an already-running site (preview deployment). Otherwise serve QA_SITE_DIR locally.
const baseURL = process.env.QA_BASE_URL || `http://localhost:${process.env.QA_PORT || 4173}`;
const executablePath = process.env.QA_CHROMIUM_PATH; // local sandboxes with a preinstalled Chromium
// Password-protected previews: any username plus the PREVIEW_PASSWORD secret.
const httpCredentials = process.env.QA_HTTP_PASSWORD
  ? { username: process.env.QA_HTTP_USER || 'qa', password: process.env.QA_HTTP_PASSWORD }
  : undefined;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }], ['list']] : [['list']],
  use: { baseURL, httpCredentials, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: process.env.QA_BASE_URL ? undefined : {
    command: 'node scripts/serve.mjs',
    url: baseURL + '/',
    reuseExistingServer: !process.env.CI,
    env: { QA_SITE_DIR: process.env.QA_SITE_DIR || '../dist', QA_PORT: process.env.QA_PORT || '4173' },
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], launchOptions: { executablePath } } },
    ...(process.env.QA_WEBKIT === '0' ? [] : [{ name: 'mobile-webkit', use: { ...devices['iPhone 14'] } }]),
  ],
});
