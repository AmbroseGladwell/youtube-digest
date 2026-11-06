import { defineConfig, devices } from "@playwright/experimental-ct-react";

// The store's screenshots, rendered from the real components against seeded content rather
// than mocked up (docs/architecture/store-listing.md, "The screenshots"). It is a separate
// config from playwright-ct.config.ts because these are not tests: they assert nothing, they
// write files, and CI must not run them.
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
    // 1280×800 is one of the two sizes the Web Store accepts, and the larger one.
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    ctPort: 3105,
  },
  projects: [{ name: "chromium" }],
});
