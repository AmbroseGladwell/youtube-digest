import { test as base } from "@playwright/experimental-ct-react";
import { BackendSimulator } from "../network/BackendSimulator.testHelper.js";
import { Launcher } from "./Launcher.testHelper.js";
import { resetTextSizeIfChanged } from "./reflowConditions.testHelper.js";

interface Fixtures {
  backendSimulator: BackendSimulator;
  launcher: Launcher;
  browserTextSizeRestored: void;
}

export const test = base.extend<Fixtures>({
  backendSimulator: ({ page }, use) => use(new BackendSimulator(page)),
  launcher: ({ backendSimulator, mount, page }, use) => use(new Launcher(mount, page, backendSimulator)),
  browserTextSizeRestored: [
    async ({ page }, use) => {
      await use();
      await resetTextSizeIfChanged(page);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/experimental-ct-react";
