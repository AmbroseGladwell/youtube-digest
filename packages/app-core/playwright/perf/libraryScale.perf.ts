import type { Page } from "@playwright/test";
import { test } from "../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../network/BackendSimulator.testHelper.js";
import { seedLargeLibrary } from "./seedLargeLibrary.testHelper.js";
import { libraryOverviewCardTestIds } from "../../src/features/library/components/LibraryOverviewCard/LibraryOverviewCardTestIds.js";
import { librarySearchTestIds } from "../../src/features/library/components/LibrarySearch/LibrarySearchTestIds.js";
import { filterMenuTestIds } from "../../src/features/library/components/FilterMenu/FilterMenuTestIds.js";
import { libraryPageTestIds } from "../../src/features/library/LibraryPage/LibraryPageTestIds.js";
import { appShellTestIds } from "../../src/shell/AppShell/AppShellTestIds.js";
import { askPageTestIds } from "../../src/features/chats/AskPage/AskPageTestIds.js";

const SIZES = (process.env.SIZES ?? "300,500,2000,5000").split(",").map(Number);
const THROTTLE = Number(process.env.THROTTLE ?? 4);
const WIDTH = Number(process.env.WIDTH ?? 390);
const SIGNED_IN = { sync: true, syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" } };

interface Probe {
  transitions: { click: number; ready: number | null }[];
  events: number[];
  frames: number[];
  clickAt: number;
}

declare global {
  interface Window {
    __probe: Probe;
  }
}

const probe = () => {
  const p: Probe = { transitions: [], events: [], frames: [], clickAt: 0 };
  window.__probe = p;
  document.addEventListener("pointerdown", () => (p.clickAt = performance.now()), true);
  document.addEventListener("keydown", () => (p.clickAt = performance.now()), true);
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      p.events.push(entry.duration);
    }
  }).observe({ type: "event", durationThreshold: 16 } as PerformanceObserverInit);
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      p.frames.push(entry.duration);
    }
  }).observe({ type: "long-animation-frame" });
  const original = document.startViewTransition?.bind(document);
  if (original === undefined) {
    return;
  }
  document.startViewTransition = ((arg: Parameters<typeof original>[0]) => {
    const row: Probe["transitions"][number] = { click: p.clickAt, ready: null };
    p.transitions.push(row);
    const transition = original(arg);
    void transition.ready.then(
      () => (row.ready = performance.now()),
      () => undefined,
    );
    return transition;
  }) as typeof document.startViewTransition;
};

const take = (page: Page) =>
  page.evaluate(() => {
    const p = window.__probe;
    const out = {
      transitions: p.transitions.map((row) => (row.ready === null ? null : Math.round(row.ready - row.click))),
      worstEvent: Math.round(Math.max(0, ...p.events)),
      longFrames: p.frames.length,
      longFrameMs: Math.round(p.frames.reduce((sum, ms) => sum + ms, 0)),
    };
    p.transitions = [];
    p.events = [];
    p.frames = [];
    return out;
  });

const settle = (page: Page, ms = 1200) => page.waitForTimeout(ms);

for (const size of SIZES) {
  test(`library at ${size} overviews, ${WIDTH}px, ${THROTTLE}x CPU`, async ({ page, launcher, backendSimulator }) => {
    await page.setViewportSize({ width: WIDTH, height: 800 });
    const devtools = await page.context().newCDPSession(page);
    await devtools.send("Performance.enable");
    await devtools.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
    seedLargeLibrary(backendSimulator, size);
    const results: Record<string, unknown> = { size, width: WIDTH, throttle: THROTTLE };

    const launchedAt = Date.now();
    await launcher.launchExpectingLibrary(SIGNED_IN);
    await page.getByTestId(libraryOverviewCardTestIds.row).first().waitFor();
    results.launchToFirstRowMs = Date.now() - launchedAt;
    await page.evaluate(probe);
    await settle(page, 4000);
    const metrics = Object.fromEntries((await devtools.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
    results.domNodes = metrics.Nodes;
    results.jsHeapMb = Math.round((metrics.JSHeapUsedSize ?? 0) / 1e5) / 10;
    results.rows = await page.getByTestId(libraryOverviewCardTestIds.row).count();
    await take(page);

    for (let step = 0; step < 15; step += 1) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(120);
    }
    await settle(page);
    results.scroll = await take(page);

    const card = page.getByTestId(libraryOverviewCardTestIds.root).filter({ hasText: /^/ });
    const viewport = page.viewportSize()!;
    let opened = -1;
    for (let index = 0; index < (await card.count()) && opened < 0; index += 1) {
      const box = await card.nth(index).boundingBox();
      if (box !== null && box.y > 80 && box.y + box.height < viewport.height) {
        opened = index;
      }
    }
    const left = await page.evaluate(() => Math.round(scrollY));
    await card.nth(opened).getByTestId(libraryOverviewCardTestIds.titleLink).click();
    await settle(page);
    await page.evaluate(() => (window.__probe.clickAt = performance.now()));
    await page.goBack();
    await settle(page, 2000);
    results.overviewAndBack = { ...(await take(page)), scrollLeft: left, scrollBack: await page.evaluate(() => Math.round(scrollY)) };

    await page.getByTestId(appShellTestIds.askButton).click();
    await page.getByTestId(askPageTestIds.root).waitFor();
    await settle(page);
    results.toAsk = await take(page);
    await page.locator("header a[href='/']").first().click();
    await page.getByTestId(libraryPageTestIds.list).waitFor();
    await settle(page, 2000);
    results.fromAsk = await take(page);

    await page.evaluate(() => scrollTo(0, 0));
    await settle(page, 400);
    const opener = page.getByTestId(librarySearchTestIds.openButton);
    if (await opener.isVisible()) {
      await opener.click();
    }
    await take(page);
    await page.getByTestId(librarySearchTestIds.input).pressSequentially("coffee", { delay: 150 });
    await settle(page, 2000);
    results.search = await take(page);
    await page.getByTestId(librarySearchTestIds.clearButton).click();
    await settle(page, 2000);
    await take(page);

    await page.getByTestId(libraryPageTestIds.filterButton).click();
    await settle(page, 600);
    await take(page);
    await page.getByTestId(filterMenuTestIds.choice("show", "unread")).click();
    await settle(page, 2000);
    results.filterUnread = await take(page);

    console.log(`PERF ${JSON.stringify(results)}`);
  });
}
