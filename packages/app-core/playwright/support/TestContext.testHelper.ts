import type { Page } from "@playwright/test";
import type { BackendSimulator } from "../network/BackendSimulator.testHelper.js";

export interface TestContext<TSimulator = BackendSimulator> {
  page: Page;
  backendSimulator: TSimulator;
}
