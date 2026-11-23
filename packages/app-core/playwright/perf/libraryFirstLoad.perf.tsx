import { writeFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { test } from "../support/fixtures.testHelper.js";
import { IwftAppRoot } from "../support/IwftAppRoot.testHelper.js";
import { SIMULATED_EMAIL } from "../network/BackendSimulator.testHelper.js";
import { seedLargeLibrary } from "./seedLargeLibrary.testHelper.js";
import { makeAnalyticsConsent } from "../../src/features/analyticsConsent/types/AnalyticsConsentFactory.testHelper.js";
import { recentOverviewsTestIds } from "../../src/features/capture/components/RecentOverviews/RecentOverviewsTestIds.js";
import { libraryOverviewCardTestIds } from "../../src/features/library/components/LibraryOverviewCard/LibraryOverviewCardTestIds.js";

const SIZES = (process.env.SIZES ?? "500,2000,5000").split(",").map(Number);
const THROTTLE = Number(process.env.THROTTLE ?? 4);
const PANEL = process.env.PANEL === "1";
const WIDTH = Number(process.env.WIDTH ?? (PANEL ? 400 : 390));
const PROFILE = process.env.PROFILE === "1";
const CONNECTION = { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" };

const firstRow = (page: Page) =>
  page
    .getByTestId(PANEL ? recentOverviewsTestIds.row : libraryOverviewCardTestIds.row)
    .first()
    .waitFor({ timeout: Number(process.env.WAIT ?? 600_000) });

// The panel opens on Recent, which shows only the newest few.
const wholeLibraryShown = async (page: Page, size: number) => {
  if (PANEL) {
    return;
  }
  await page
    .locator(`[aria-setsize="${size / 2}"]`)
    .first()
    .waitFor({ state: "attached", timeout: Number(process.env.WAIT ?? 600_000) });
};

for (const size of SIZES) {
  test(`first load from IndexedDB at ${size} overviews, ${PANEL ? "panel" : "web"} ${WIDTH}px, ${THROTTLE}x CPU`, async ({
    page,
    mount,
    backendSimulator,
  }) => {
    await page.setViewportSize({ width: WIDTH, height: PANEL ? 600 : 800 });
    const devtools = await page.context().newCDPSession(page);
    await devtools.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
    seedLargeLibrary(backendSimulator, size, { statesFrom: "feed" });
    await backendSimulator.handleNetworking();
    const launch = (indexedDbLibrary: "fresh" | "kept") =>
      mount(<IwftAppRoot />, {
        hooksConfig: {
          ...backendSimulator.buildHooksConfig(),
          seedOverviews: [],
          syncAvailable: true,
          syncConnection: CONNECTION,
          analyticsConsent: makeAnalyticsConsent(),
          indexedDbLibrary,
          ...(PANEL ? { surface: "extension" as const, layout: "panel" as const } : {}),
        },
      });

    let launchedAt = Date.now();
    const pages: number[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/api/changes")) {
        pages.push(Date.now() - launchedAt);
      }
    });
    const lastPage = page.waitForResponse(
      async (response) => response.url().includes("/api/changes") && ((await response.json()) as { more: boolean }).more === false,
      { timeout: Number(process.env.WAIT ?? 600_000) },
    );
    await launch("fresh");
    await firstRow(page);
    const newDeviceFirstRowMs = Date.now() - launchedAt;
    await lastPage;
    await wholeLibraryShown(page, size);
    const newDeviceWholeLibraryMs = Date.now() - launchedAt;
    const syncPages = [...pages];
    await page.waitForTimeout(2000);
    if (PROFILE) {
      await page.addInitScript(() => {
        const t0 = performance.now();
        const log: string[] = [];
        (window as unknown as { __timeline: string[] }).__timeline = log;
        const original = IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction = function (names, mode, options) {
          const started = Math.round(performance.now() - t0);
          const tx = original.call(this, names, mode, options);
          const label = [...(typeof names === "string" ? [names] : names)].join(",");
          tx.addEventListener("complete", () =>
            log.push(`idb ${mode ?? "readonly"} ${label} ${started}-${Math.round(performance.now() - t0)}`),
          );
          return tx;
        };
        const originalOpen = IDBFactory.prototype.open;
        IDBFactory.prototype.open = function (name, version) {
          const started = Math.round(performance.now() - t0);
          const request = originalOpen.call(this, name, version);
          request.addEventListener("success", () => log.push(`idb open ${name} ${started}-${Math.round(performance.now() - t0)}`));
          return request;
        };
        addEventListener("DOMContentLoaded", () => log.push(`dom ready ${Math.round(performance.now() - t0)}`));
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
          const started = Math.round(performance.now() - t0);
          try {
            return await originalFetch(...args);
          } finally {
            log.push(
              `fetch ${String(args[0] instanceof Request ? args[0].url : args[0]).replace(/^https?:\/\/[^/]+/, "")} ${started}-${Math.round(performance.now() - t0)}`,
            );
          }
        };
        new MutationObserver((_, observer) => {
          const size = document.querySelector("[aria-setsize]")?.getAttribute("aria-setsize");
          if (size !== undefined && size !== null && !log.includes(`set size ${size}`)) {
            log.push(`set size ${size}`, `  at ${Math.round(performance.now() - t0)}`);
          }
        }).observe(document, { childList: true, subtree: true });
      });
    }
    await page.reload();
    await devtools.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });

    launchedAt = Date.now();
    pages.length = 0;
    if (PROFILE) {
      await devtools.send("Profiler.enable");
      await devtools.send("Profiler.start");
    }
    await launch("kept");
    await firstRow(page);
    const returningFirstRowMs = Date.now() - launchedAt;
    if (PROFILE) {
      const { profile } = await devtools.send("Profiler.stop");
      writeFileSync(test.info().outputPath("returning.cpuprofile"), JSON.stringify(profile));
      await page.waitForTimeout(1000);
      console.log((await page.evaluate(() => (window as unknown as { __timeline: string[] }).__timeline)).join("\n"));
    }
    await wholeLibraryShown(page, size);
    const returningWholeLibraryMs = Date.now() - launchedAt;

    console.log(
      `PERF-FIRST-LOAD ${JSON.stringify({
        size,
        surface: PANEL ? "panel" : "web",
        width: WIDTH,
        throttle: THROTTLE,
        newDevice: {
          firstRowMs: newDeviceFirstRowMs,
          wholeLibraryMs: newDeviceWholeLibraryMs,
          changesPages: syncPages.length,
          lastPageMs: syncPages.at(-1),
        },
        returning: { firstRowMs: returningFirstRowMs, wholeLibraryMs: returningWholeLibraryMs, changesPages: pages.length },
      })}`,
    );
  });
}
