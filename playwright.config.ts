import { defineConfig, devices } from '@playwright/test';

const MOCK_PORT = 8787;
const APP_PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  // Nacheinander: ein Test simuliert ein Update, indem er dist/sw.js kurz ändert.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `node tests/mock-api/server.mjs --port ${MOCK_PORT}`,
      url: `http://localhost:${MOCK_PORT}/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Zweiter Mock ohne CORS-Header, um "CORS blockiert" zu testen.
      command: `node tests/mock-api/server.mjs --port ${MOCK_PORT + 1} --no-cors`,
      url: `http://localhost:${MOCK_PORT + 1}/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run build && npm run preview',
      url: `http://localhost:${APP_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
