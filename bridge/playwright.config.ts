import { defineConfig, devices } from '@playwright/test';

/**
 * Visual harness.
 *
 * The dev server is started automatically. Captures run at the reference
 * viewport (the crop measured off the supplied screenshots) plus the
 * responsive breakpoints listed in the brief.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1728, height: 912 },
    deviceScaleFactor: 1,
    // Deterministic rendering: no OS animations, stable font rasterisation.
    launchOptions: {
      args: [
        '--force-color-profile=srgb',
        '--disable-lcd-text',
        '--use-gl=angle',
        '--enable-unsafe-swiftshader',
      ],
    },
  },

  projects: [
    {
      name: 'reference',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1728, height: 912 } },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
