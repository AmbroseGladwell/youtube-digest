import { defineConfig, devices } from "@playwright/experimental-ct-react";

// Why apart from playwright-ct.config.ts: docs/architecture/store-listing.md, "The screenshots".
export default defineConfig({
  testDir: "./playwright/store",
  testMatch: "**/*.shot.tsx",
  timeout: 60_000,
  // One at a time, so the shots come out in a deterministic order and share one browser.
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    // The larger of the two sizes the Web Store accepts.
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    ctPort: 3105,
  },
  projects: [{ name: "chromium" }],
});
