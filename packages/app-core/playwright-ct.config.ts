import { defineConfig, devices } from "@playwright/experimental-ct-react";

export default defineConfig({
  testDir: "./playwright/iwft/scenarios",
  testMatch: "**/*.iwft.ts",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list", { printSteps: !!process.env.CI }]],
  use: {
    trace: "retain-on-failure",
    ctPort: 3104,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
