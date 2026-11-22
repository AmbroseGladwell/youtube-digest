import { test, expect } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const PHONE = { width: 390, height: 844 };
const LIBRARY_SIZE = 120;

// Titles of one to four lines, so rows differ in height as a real library's do.
const seedALongLibrary = (seed: (overview: ReturnType<typeof makeOverview>) => void) => {
  for (let index = 0; index < LIBRARY_SIZE; index += 1) {
    const overview = makeOverview({ savedAt: new Date(Date.UTC(2026, 0, 1) + index * 3_600_000).toISOString() });
    overview.source.title = `Overview ${LIBRARY_SIZE - index}: ${"a longer title ".repeat(index % 7)}`.trim();
    seed(overview);
  }
};

test("a long library puts only the rows near the screen in the page, and still says how long the list is", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  seedALongLibrary((overview) => backendSimulator.overviews.seed(overview));
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary();

  await library.verifyRowsInThePageAtMost(20);
  await library.verifyListSays(LIBRARY_SIZE);
});

test("on a phone, coming back from an overview deep in a long library puts its row exactly where it was", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  seedALongLibrary((overview) => backendSimulator.overviews.seed(overview));
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary();
  for (let screen = 0; screen < 8; screen += 1) {
    await page.mouse.wheel(0, 900);
  }
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(6_000);
  const left = await library.readScrollPosition();
  const row = await library.readARowOnScreen();
  const reader = await library.openTheRow(row.title);

  const libraryAgain = await reader.clickBackToLibrary();

  await libraryAgain.verifyScrollPosition(left);
  await libraryAgain.verifyRowIsAt(row);
});

test("Tab walks on from the last row in the page to the next one", async ({ launcher, backendSimulator, page }) => {
  seedALongLibrary((overview) => backendSimulator.overviews.seed(overview));
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary();

  const { from, to } = await library.tabPastTheLastRowInThePage();

  expect(to).toBe(from + 1);
});
