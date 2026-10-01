import { expect } from "@playwright/experimental-ct-react";
import { libraryPageTestIds } from "../../src/features/library/LibraryPage/LibraryPageTestIds.js";
import { appShellTestIds } from "../../src/shell/AppShell/AppShellTestIds.js";
import { libraryOverviewCardTestIds } from "../../src/features/library/components/LibraryOverviewCard/LibraryOverviewCardTestIds.js";
import { libraryUnreadableCardTestIds } from "../../src/features/library/components/LibraryUnreadableCard/LibraryUnreadableCardTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { FilterPanelPageObject } from "./FilterPanelPageObject.testHelper.js";
import { GenerateOverviewFormPageObject } from "./GenerateOverviewFormPageObject.testHelper.js";
import { LibraryOverviewCardPageObject } from "./LibraryOverviewCardPageObject.testHelper.js";
import { LibraryUnreadableCardPageObject } from "./LibraryUnreadableCardPageObject.testHelper.js";
import { NewTopicDialogPageObject } from "./NewTopicDialogPageObject.testHelper.js";
import { SortPillPageObject } from "./SortPillPageObject.testHelper.js";
import { MilestoneStackPageObject } from "./MilestoneStackPageObject.testHelper.js";
import { TimeSavedSheetPageObject } from "./TimeSavedSheetPageObject.testHelper.js";

export class LibraryPageObject extends PageObject {
  get filterPanel(): FilterPanelPageObject {
    return new FilterPanelPageObject(this.testContext);
  }

  get milestones(): MilestoneStackPageObject {
    return new MilestoneStackPageObject(this.testContext);
  }

  // The figure is drawn as rolling digits, so what it says is read from its accessible name.
  verifyTimeSavedSays = (spoken: string) =>
    this.step(`verifyTimeSavedSays ${spoken}`, () =>
      expect(this.get(libraryPageTestIds.timeSavedButton)).toHaveAttribute("aria-label", `Time saved: ${spoken}`),
    );

  verifyTimeSavedShows = (figure: string) =>
    this.step(`verifyTimeSavedShows ${figure}`, () =>
      expect(this.get(libraryPageTestIds.timeSavedButton)).toHaveText(`${figure}saved`),
    );

  openTimeSaved = (): Promise<TimeSavedSheetPageObject> =>
    this.step("openTimeSaved", async () => {
      await this.click(libraryPageTestIds.timeSavedButton);
      return new TimeSavedSheetPageObject(this.testContext).verifyIsShown();
    });

  get sortPill(): SortPillPageObject {
    return new SortPillPageObject(this.testContext);
  }

  // Both kinds of card, in the order the list lays them out, so a test can see where an
  // unreadable record lands among the readable ones.
  verifyCardOrder = (titles: string[]) =>
    this.step(`verifyCardOrder ${titles.join(", ")}`, () =>
      expect(
        this.get(libraryPageTestIds.list).locator(
          [libraryOverviewCardTestIds.root, libraryUnreadableCardTestIds.root]
            .map((testId) => `[data-testid="${testId}"]`)
            .join(", "),
        ),
      ).toHaveText(titles.map((title) => new RegExp(title))),
    );

  get newTopicDialog(): NewTopicDialogPageObject {
    return new NewTopicDialogPageObject(this.testContext);
  }

  openNewTopic = (): Promise<NewTopicDialogPageObject> =>
    this.step("openNewTopic", async () => {
      await this.filterPanel.clickNewTopic();
      return this.newTopicDialog.verifyIsShown();
    });

  get generateForm(): GenerateOverviewFormPageObject {
    return new GenerateOverviewFormPageObject(this.testContext);
  }

  verifyIsShown = (): Promise<LibraryPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(libraryPageTestIds.root);
      return this;
    });

  // The search sits over the list rather than in the rail (design 2a), so it is the
  // page's rather than the filter panel's.
  search = (query: string) =>
    this.step(`search ${query}`, () => this.get(libraryPageTestIds.searchInput).fill(query));

  clearTheSearch = () =>
    this.step("clearTheSearch", () => this.click(libraryPageTestIds.clearSearchButton));

  verifyOffersToClearTheSearch = (offered: boolean) =>
    this.step(`verifyOffersToClearTheSearch ${offered}`, () =>
      offered
        ? this.expectToBeVisible(libraryPageTestIds.clearSearchButton)
        : this.expectNotToBeVisible(libraryPageTestIds.clearSearchButton),
    );

  verifySearchReads = (query: string) =>
    this.step(`verifySearchReads ${query}`, () =>
      expect(this.get(libraryPageTestIds.searchInput)).toHaveValue(query),
    );

  scrollTheList = () =>
    this.step("scrollTheList", async () => {
      await this.page.mouse.wheel(0, 900);
      await expect(async () => {
        expect(await this.page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
      }).toPass({ timeout: 2_000 });
    });

  // The rail is chrome: it comes to rest on the masthead's lower edge and stays there while
  // the list scrolls past it (docs/features/overview-redesign.md, "Chrome that stays put").
  verifyRailRestsOnTheMasthead = () =>
    this.step("verifyRailRestsOnTheMasthead", () =>
      expect(async () => {
        const masthead = (await this.page.getByTestId(appShellTestIds.masthead).boundingBox())!;
        const rail = (await this.get(libraryPageTestIds.railBody).boundingBox())!;
        expect(Math.round(rail.y)).toBe(Math.round(masthead.y + masthead.height));
      }).toPass({ timeout: 2_000 }),
    );

  verifyRailDividerRunsToTheFoot = () =>
    this.step("verifyRailDividerRunsToTheFoot", async () => {
      const rail = (await this.get(libraryPageTestIds.rail).boundingBox())!;
      expect(Math.round(rail.y + rail.height)).toBeGreaterThanOrEqual(this.page.viewportSize()!.height);
    });

  // On a phone the rail is a sheet over the page, opened from the bar (design 2a).
  openFilters = () =>
    this.step("openFilters", async () => {
      await this.click(libraryPageTestIds.filterButton);
      await this.verifyFiltersAreOpen(true);
    });

  // The sheet slides off the side rather than unmounting, so what says it is open is the
  // button's own state and where the sheet has come to rest.
  verifyFiltersAreOpen = (open: boolean) =>
    this.step(`verifyFiltersAreOpen ${open}`, () =>
      expect(async () => {
        await expect(this.get(libraryPageTestIds.filterButton)).toHaveAttribute(
          "aria-expanded",
          String(open),
        );
        const rail = (await this.get(libraryPageTestIds.rail).boundingBox())!;
        const width = this.page.viewportSize()!.width;
        expect(rail.x < width - 40).toBe(open);
      }).toPass({ timeout: 4_000 }),
    );

  verifyFilterSheetClearsTheBar = () =>
    this.step("verifyFilterSheetClearsTheBar", async () => {
      const masthead = (await this.page.getByTestId(appShellTestIds.masthead).boundingBox())!;
      const head = (await this.get(libraryPageTestIds.closeFiltersButton).boundingBox())!;
      expect(head.y).toBeGreaterThanOrEqual(masthead.y + masthead.height);
    });

  // Tab all the way round the sheet's own controls and a little past them: every stop
  // has to land back inside it, or the reader is lost behind a sheet they cannot see.
  verifyTabbingStaysInTheFilterSheet = (stops: number) =>
    this.step(`verifyTabbingStaysInTheFilterSheet ${stops}`, async () => {
      for (let step = 0; step < stops; step += 1) {
        await this.page.keyboard.press("Tab");
        expect(
          await this.get(libraryPageTestIds.rail).evaluate((rail) =>
            rail.contains(document.activeElement),
          ),
        ).toBe(true);
      }
    });

  closeFiltersWithEscape = () =>
    this.step("closeFiltersWithEscape", async () => {
      await this.page.keyboard.press("Escape");
      await this.verifyFiltersAreOpen(false);
    });

  verifyFocusIsOnTheFilterButton = () =>
    this.step("verifyFocusIsOnTheFilterButton", () =>
      expect(this.get(libraryPageTestIds.filterButton)).toBeFocused(),
    );

  verifyEmptyState = () => this.step("verifyEmptyState", () => this.expectToBeVisible(libraryPageTestIds.empty));

  expectCardCountToBe = (count: number) =>
    this.step(`expectCardCountToBe ${count}`, () => this.expectToHaveCount(libraryOverviewCardTestIds.root, count));

  verifyCountReads = (count: string) =>
    this.step(`verifyCountReads ${count}`, () =>
      expect(this.get(libraryPageTestIds.listCount)).toHaveText(count),
    );

  nthCard = (index: number): LibraryOverviewCardPageObject =>
    new LibraryOverviewCardPageObject(this.testContext, this.get(libraryOverviewCardTestIds.root).nth(index));

  get unreadableCard(): LibraryUnreadableCardPageObject {
    return new LibraryUnreadableCardPageObject(this.testContext);
  }

  verifyFilterCountReads = (count: string) =>
    this.step(`verifyFilterCountReads ${count}`, () =>
      expect(this.get(libraryPageTestIds.rail).getByText(count)).toBeVisible(),
    );

  cardWithTitle = (title: string): LibraryOverviewCardPageObject =>
    new LibraryOverviewCardPageObject(
      this.testContext,
      this.get(libraryOverviewCardTestIds.root).filter({ hasText: title }),
    );
}
