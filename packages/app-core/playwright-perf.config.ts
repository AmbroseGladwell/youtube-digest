import base from "./playwright-ct.config.js";
import { defineConfig } from "@playwright/experimental-ct-react";

export default defineConfig({
  ...base,
  testDir: "./playwright/perf",
  testMatch: "**/*.perf.ts",
  timeout: 900_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { ...base.use, trace: "off", ctPort: 3106 },
});
