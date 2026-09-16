import { test as base } from "@playwright/experimental-ct-react";
import { BackendSimulator } from "../network/BackendSimulator.testHelper.js";
import { Launcher } from "./Launcher.testHelper.js";

interface Fixtures {
  backendSimulator: BackendSimulator;
  launcher: Launcher;
}

export const test = base.extend<Fixtures>({
  backendSimulator: ({ page }, use) => use(new BackendSimulator(page)),
  launcher: ({ backendSimulator, mount, page }, use) => use(new Launcher(mount, page, backendSimulator)),
});

export { expect } from "@playwright/experimental-ct-react";
