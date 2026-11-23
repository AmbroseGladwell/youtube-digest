import { expect } from "@playwright/experimental-ct-react";
import { libraryPageTestIds } from "../../src/features/library/LibraryPage/LibraryPageTestIds.js";
import { librarySearchTestIds } from "../../src/features/library/components/LibrarySearch/LibrarySearchTestIds.js";
import { appShellTestIds } from "../../src/shell/AppShell/AppShellTestIds.js";
import { libraryOverviewCardTestIds } from "../../src/features/library/components/LibraryOverviewCard/LibraryOverviewCardTestIds.js";
import { libraryUnreadableCardTestIds } from "../../src/features/library/components/LibraryUnreadableCard/LibraryUnreadableCardTestIds.js";
import { ToastPageObject } from "./ToastPageObject.testHelper.js";
import { SelectionBarPageObject } from "./SelectionBarPageObject.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";
import { libraryFilterChipsTestIds } from "../../src/features/library/components/LibraryFilterChips/LibraryFilterChipsTestIds.js";
import { filterPanelTestIds } from "../../src/features/library/components/FilterPanel/FilterPanelTestIds.js";
import { FilterPanelPageObject } from "./FilterPanelPageObject.testHelper.js";
import { GenerateOverviewFormPageObject } from "./GenerateOverviewFormPageObject.testHelper.js";
import type { ReaderPageObject } from "./ReaderPageObject.testHelper.js";
import { LibraryOverviewCardPageObject } from "./LibraryOverviewCardPageObject.testHelper.js";
import { LibraryUnreadableCardPageObject } from "./LibraryUnreadableCardPageObject.testHelper.js";
import { NewTopicDialogPageObject } from "./NewTopicDialogPageObject.testHelper.js";
import { SortPillPageObject } from "./SortPillPageObject.testHelper.js";
import { MilestoneStackPageObject } from "./MilestoneStackPageObject.testHelper.js";
import { TimeSavedSheetPageObject } from "./TimeSavedSheetPageObject.testHelper.js";
import { ProjectsRailGroupPageObject } from "./ProjectsRailGroupPageObject.testHelper.js";
import { ProjectHeadPageObject } from "./ProjectHeadPageObject.testHelper.js";

export class LibraryPageObject extends PageObject {
  get filterPanel(): FilterPanelPageObject {
    return new FilterPanelPageObject(this.testContext);
  }

  get projectsRail(): ProjectsRailGroupPageObject {
    return new ProjectsRailGroupPageObject(this.testContext);
  }

  get projectHead(): ProjectHeadPageObject {
    return new ProjectHeadPageObject(this.testContext);
  }

  get milestones(): MilestoneStackPageObject {
    return new MilestoneStackPageObject(this.testContext);
  }

  // The figure is drawn as rolling digits, so it is read from its accessible name.
  verifyTimeSavedSays = (spoken: string) =>
    this.step(`verifyTimeSavedSays ${spoken}`, () =>
      expect(this.get(libraryPageTestIds.timeSavedButton)).toHaveAttribute("aria-label", `${spoken} saved`),
    );

  verifyTimeSavedShows = (figure: string) =>
    this.step(`verifyTimeSavedShows ${figure}`, () => expect(this.get(libraryPageTestIds.timeSavedButton)).toHaveText(`${figure}saved`));

  openTimeSaved = (): Promise<TimeSavedSheetPageObject> =>
    this.step("openTimeSaved", async () => {
      await this.click(libraryPageTestIds.timeSavedButton);
      return new TimeSavedSheetPageObject(this.testContext).verifyIsShown();
    });

  get sortPill(): SortPillPageObject {
    return new SortPillPageObject(this.testContext);
  }

  verifyCardOrder = (titles: string[]) =>
    this.step(`verifyCardOrder ${titles.join(", ")}`, () =>
      expect(
        this.get(libraryPageTestIds.list).locator(
          [libraryOverviewCardTestIds.root, libraryUnreadableCardTestIds.root].map((testId) => `[data-testid="${testId}"]`).join(", "),
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

  search = (query: string) =>
    this.step(`search ${query}`, async () => {
      if (await this.get(librarySearchTestIds.openButton).isVisible()) {
        await this.click(librarySearchTestIds.openButton);
      }
      await this.get(librarySearchTestIds.input).fill(query);
    });

  openSearch = () => this.step("openSearch", () => this.click(librarySearchTestIds.openButton));

  // `fill` sets the whole value at once, which hides a dropped key (OV-292).
  typeInTheSearch = (text: string) =>
    this.step(`typeInTheSearch ${text}`, async () => {
      if (await this.get(librarySearchTestIds.openButton).isVisible()) {
        await this.click(librarySearchTestIds.openButton);
      }
      await this.get(librarySearchTestIds.input).pressSequentially(text, { delay: 0 });
    });

  verifyTheAddressHoldsTheSearch = (query: string) =>
    this.step(`verifyTheAddressHoldsTheSearch ${query}`, () =>
      expect.poll(() => new URL(this.page.url()).searchParams.get("q") ?? "").toBe(query),
    );

  verifySearchIsFolded = (folded: boolean) =>
    this.step(`verifySearchIsFolded ${folded}`, async () => {
      if (folded) {
        await this.expectToBeVisible(librarySearchTestIds.openButton);
        await expect(this.get(librarySearchTestIds.input)).not.toBeVisible();
      } else {
        await this.expectNotToBeVisible(librarySearchTestIds.openButton);
        await expect(this.get(librarySearchTestIds.input)).toBeVisible();
      }
    });

  verifySearchIconIsCentred = () =>
    this.step("verifySearchIconIsCentred", async () => {
      const opener = this.get(librarySearchTestIds.openButton);
      const pill = await opener.locator("..").boundingBox();
      const icon = await opener.locator("svg").boundingBox();
      const centre = (box: { x: number; y: number; width: number; height: number } | null) =>
        box === null ? null : { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
      expect(centre(icon)).toEqual(centre(pill));
    });

  verifySearchIsFocused = () => this.step("verifySearchIsFocused", () => expect(this.get(librarySearchTestIds.input)).toBeFocused());

  blurTheSearch = () => this.step("blurTheSearch", () => this.get(librarySearchTestIds.input).blur());

  pressEscapeInTheSearch = () => this.step("pressEscapeInTheSearch", () => this.get(librarySearchTestIds.input).press("Escape"));

  startSelecting = () =>
    this.step("startSelecting", async () => {
      await this.click(libraryPageTestIds.selectButton);
      await expect(this.get(libraryPageTestIds.selectButton)).toHaveAttribute("aria-pressed", "true");
    });

  stopSelecting = () =>
    this.step("stopSelecting", async () => {
      await this.click(libraryPageTestIds.selectButton);
      await expect(this.get(libraryPageTestIds.selectButton)).toHaveAttribute("aria-pressed", "false");
    });

  verifySelectButtonReads = (label: string) =>
    this.step(`verifySelectButtonReads ${label}`, () =>
      expect(this.get(libraryPageTestIds.selectButton)).toHaveAttribute("aria-label", label),
    );

  verifyOffersSelect = (offered: boolean) =>
    this.step(`verifyOffersSelect ${offered}`, () =>
      offered ? this.expectToBeVisible(libraryPageTestIds.selectButton) : this.expectToHaveCount(libraryPageTestIds.selectButton, 0),
    );

  pick = (title: string) => this.step(`pick ${title}`, () => this.get(libraryOverviewCardTestIds.root).filter({ hasText: title }).click());

  verifyPicked = (title: string, picked: boolean) =>
    this.step(`verifyPicked ${title} ${picked}`, () =>
      expect(this.page.getByRole("checkbox", { name: title, exact: false })).toHaveAttribute("aria-checked", String(picked)),
    );

  verifySelectionLineReads = (text: string) =>
    this.step(`verifySelectionLineReads ${text}`, () => expect(this.get(libraryPageTestIds.selectionLine)).toHaveText(text));

  get selectionBar(): SelectionBarPageObject {
    return new SelectionBarPageObject(this.testContext);
  }

  get toast(): ToastPageObject {
    return new ToastPageObject(this.testContext);
  }

  verifySelectButtonIsFocused = () =>
    this.step("verifySelectButtonIsFocused", () => expect(this.get(libraryPageTestIds.selectButton)).toBeFocused());

  clearTheSearch = () => this.step("clearTheSearch", () => this.click(librarySearchTestIds.clearButton));

  verifyOffersToClearTheSearch = (offered: boolean) =>
    this.step(`verifyOffersToClearTheSearch ${offered}`, () =>
      offered ? this.expectToBeVisible(librarySearchTestIds.clearButton) : this.expectNotToBeVisible(librarySearchTestIds.clearButton),
    );

  verifySearchReads = (query: string) =>
    this.step(`verifySearchReads ${query}`, () => expect(this.get(librarySearchTestIds.input)).toHaveValue(query));

  scrollTheList = () =>
    this.step("scrollTheList", async () => {
      await this.page.mouse.wheel(0, 900);
      await expect(async () => {
        expect(await this.page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
      }).toPass({ timeout: 2_000 });
    });

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

  openFiltersWhereFolded = () =>
    this.step("openFiltersWhereFolded", async () => {
      if (await this.get(libraryPageTestIds.filterButton).isVisible()) {
        await this.openFilters();
      }
    });

  verifyFilterControlsCanBeReached = () => this.verifyControlsCanBeReached(this.get(libraryPageTestIds.rail));

  openFilters = () =>
    this.step("openFilters", async () => {
      await this.click(libraryPageTestIds.filterButton);
      await this.verifyFiltersAreOpen(true);
    });

  // The sheet slides off rather than unmounting, so its open state is read from the button and its rest.
  verifyFiltersAreOpen = (open: boolean) =>
    this.step(`verifyFiltersAreOpen ${open}`, () =>
      expect(async () => {
        await expect(this.get(libraryPageTestIds.filterButton)).toHaveAttribute("aria-expanded", String(open));
        const rail = (await this.get(libraryPageTestIds.rail).boundingBox())!;
        const height = this.page.viewportSize()!.height;
        expect(rail.y < height - 40).toBe(open);
      }).toPass({ timeout: 4_000 }),
    );

  verifyFilterSheetIsReachable = (reachable: boolean) =>
    this.step(`verifyFilterSheetIsReachable ${reachable}`, async () => {
      await expect(this.get(libraryPageTestIds.rail)).toHaveJSProperty("inert", !reachable);
      const option = this.page.getByTestId(filterPanelTestIds.favouriteChip);
      const tookFocus = await option.evaluate((button: HTMLElement) => {
        button.focus();
        return document.activeElement === button;
      });
      expect(tookFocus).toBe(reachable);
    });

  verifyFilterSheetClearsTheBar = () =>
    this.step("verifyFilterSheetClearsTheBar", async () => {
      const masthead = (await this.page.getByTestId(appShellTestIds.masthead).boundingBox())!;
      const head = (await this.get(libraryPageTestIds.closeFiltersButton).boundingBox())!;
      expect(head.y).toBeGreaterThanOrEqual(masthead.y + masthead.height);
    });

  verifyTabbingStaysInTheFilterSheet = (stops: number) =>
    this.step(`verifyTabbingStaysInTheFilterSheet ${stops}`, async () => {
      for (let step = 0; step < stops; step += 1) {
        await this.page.keyboard.press("Tab");
        expect(await this.get(libraryPageTestIds.rail).evaluate((rail) => rail.contains(document.activeElement))).toBe(true);
      }
    });

  // The glide paints above any z-index, so the sheet stays over the rows only if it is captured too.
  verifyTheGlideCapturesTheFilterSheet = (change: () => Promise<void>) =>
    this.step("verifyTheGlideCapturesTheFilterSheet", async () => {
      const wanted = ["::view-transition-group(library-filter-sheet)", "::view-transition-group(library-filter-scrim)"];
      const captured = this.page.evaluate(
        (names) =>
          new Promise<string[]>((resolve) => {
            const seen = new Set<string>();
            const start = performance.now();
            const look = () => {
              for (const animation of document.getAnimations()) {
                const pseudo = (animation.effect as KeyframeEffect | null)?.pseudoElement;
                if (pseudo) {
                  seen.add(pseudo);
                }
              }
              if (names.every((name) => seen.has(name)) || performance.now() - start > 4_000) {
                resolve([...seen]);
              } else {
                requestAnimationFrame(look);
              }
            };
            look();
          }),
        wanted,
      );
      await change();
      expect(await captured).toEqual(expect.arrayContaining(wanted));
    });

  closeFiltersWithEscape = () =>
    this.step("closeFiltersWithEscape", async () => {
      await this.page.keyboard.press("Escape");
      await this.verifyFiltersAreOpen(false);
    });

  verifyFilterButtonSays = (label: string) =>
    this.step(`verifyFilterButtonSays ${label}`, () => expect(this.get(libraryPageTestIds.filterButton)).toHaveAccessibleName(label));

  showResults = (label: string) =>
    this.step(`showResults ${label}`, async () => {
      await expect(this.get(libraryPageTestIds.showResultsButton)).toHaveText(label);
      await this.click(libraryPageTestIds.showResultsButton);
      await this.verifyFiltersAreOpen(false);
    });

  verifyFocusIsOnTheFilterButton = () =>
    this.step("verifyFocusIsOnTheFilterButton", () => expect(this.get(libraryPageTestIds.filterButton)).toBeFocused());

  showAll = () => this.step("showAll", () => this.click(libraryPageTestIds.showAllButton));

  resetView = () => this.step("resetView", () => this.click(libraryPageTestIds.resetViewButton));

  verifyViewReads = (summary: string) =>
    this.step(`verifyViewReads ${summary}`, () => expect(this.get(libraryPageTestIds.viewSummary)).toHaveText(summary));

  verifyOffersReset = (offered: boolean) =>
    this.step(`verifyOffersReset ${offered}`, () =>
      offered ? this.expectToBeVisible(libraryPageTestIds.resetViewButton) : this.expectNotToBeVisible(libraryPageTestIds.resetViewButton),
    );

  verifyCaughtUp = () => this.step("verifyCaughtUp", () => this.expectToBeVisible(libraryPageTestIds.caughtUp));

  showAllFromCaughtUp = () => this.step("showAllFromCaughtUp", () => this.click(libraryPageTestIds.caughtUpShowAllButton));

  verifyCloseInMeaningShows = (titles: string[]) =>
    this.step(`verifyCloseInMeaningShows ${titles.join(", ")}`, () =>
      expect(this.get(libraryPageTestIds.meaningGroup).getByTestId(libraryOverviewCardTestIds.titleLink)).toHaveText(
        titles.map((title) => new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)),
      ),
    );

  verifySaidInTranscriptsShows = (rows: Array<{ title: string; said: string; marked: string[] }>) =>
    this.step(`verifySaidInTranscriptsShows ${rows.map((row) => row.title).join(", ")}`, async () => {
      const group = this.get(libraryPageTestIds.saidGroup);
      await expect(group.getByRole("heading", { level: 2 })).toHaveText("Said in the transcripts");
      await expect(group.getByTestId(libraryOverviewCardTestIds.titleLink)).toHaveText(
        rows.map((row) => new RegExp(`^${row.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)),
      );
      await expect(group.getByTestId(libraryOverviewCardTestIds.saidLink)).toHaveText(rows.map((row) => row.said));
      await expect(group.locator("mark")).toHaveText(rows.flatMap((row) => row.marked));
    });

  verifyNoSaidInTranscripts = () => this.step("verifyNoSaidInTranscripts", () => this.expectToHaveCount(libraryPageTestIds.saidGroup, 0));

  verifyTranscriptsUnavailable = () =>
    this.step("verifyTranscriptsUnavailable", () => this.expectToBeVisible(libraryPageTestIds.transcriptsUnavailable));

  openTheMomentSaid = (title: string): Promise<ReaderPageObject> =>
    this.step(`openTheMomentSaid ${title}`, () =>
      new LibraryOverviewCardPageObject(
        this.testContext,
        this.get(libraryPageTestIds.saidGroup).getByTestId(libraryOverviewCardTestIds.root).filter({ hasText: title }),
      ).openTheMomentSaid(),
    );

  verifyNoCloseInMeaning = () => this.step("verifyNoCloseInMeaning", () => this.expectToHaveCount(libraryPageTestIds.meaningGroup, 0));

  verifyMeaningUnavailable = () =>
    this.step("verifyMeaningUnavailable", () => this.expectToBeVisible(libraryPageTestIds.meaningUnavailable));

  verifyEmptyState = () => this.step("verifyEmptyState", () => this.expectToBeVisible(libraryPageTestIds.empty));

  expectCardCountToBe = (count: number) =>
    this.step(`expectCardCountToBe ${count}`, () => this.expectToHaveCount(libraryOverviewCardTestIds.root, count));

  verifyChipsRead = (chips: string[]) =>
    this.step(`verifyChipsRead ${chips.join(", ")}`, () =>
      expect(this.page.getByRole("group", { name: "Filters set" }).locator(":scope > span, :scope > button")).toHaveText(chips),
    );

  verifyNoChips = () => this.step("verifyNoChips", () => this.expectToHaveCount(libraryFilterChipsTestIds.root, 0));

  removeChip = (key: string) => this.step(`removeChip ${key}`, () => this.click(libraryFilterChipsTestIds.removeButton(key)));

  openMoreChips = () =>
    this.step("openMoreChips", async () => {
      await this.click(libraryFilterChipsTestIds.moreButton);
      await this.verifyFiltersAreOpen(true);
    });

  verifySearchPlaceholderReads = (placeholder: string) =>
    this.step(`verifySearchPlaceholderReads ${placeholder}`, () =>
      expect(this.get(librarySearchTestIds.input)).toHaveAttribute("placeholder", placeholder),
    );

  verifyCountReads = (count: string) =>
    this.step(`verifyCountReads ${count}`, () => expect(this.get(libraryPageTestIds.listCount)).toHaveText(count));

  nthCard = (index: number): LibraryOverviewCardPageObject =>
    new LibraryOverviewCardPageObject(this.testContext, this.get(libraryOverviewCardTestIds.root).nth(index));

  // Already wholly on screen, so opening it moves the page nowhere.
  openReaderFromACardOnScreen = (): Promise<ReaderPageObject> =>
    this.step("openReaderFromACardOnScreen", async () => {
      const cards = this.get(libraryOverviewCardTestIds.root);
      const viewport = this.page.viewportSize()!;
      const count = await cards.count();
      for (let index = 0; index < count; index += 1) {
        const box = await cards.nth(index).boundingBox();
        if (box !== null && box.y >= 0 && box.y + box.height <= viewport.height) {
          return this.nthCard(index).openReader();
        }
      }
      throw new Error("No library card is wholly on screen");
    });

  verifyRowsInThePageAtMost = (most: number) =>
    this.step(`verifyRowsInThePageAtMost ${most}`, async () => {
      const rows = await this.list().getByRole("listitem").count();
      expect(rows).toBeGreaterThan(0);
      expect(rows).toBeLessThanOrEqual(most);
    });

  verifyListSays = (length: number) =>
    this.step(`verifyListSays ${length}`, async () => {
      const first = this.list().getByRole("listitem").first();
      await expect(first).toHaveAttribute("aria-setsize", String(length));
      await expect(first).toHaveAttribute("aria-posinset", "1");
    });

  readARowOnScreen = (): Promise<{ title: string; top: number }> =>
    this.step("readARowOnScreen", async () => {
      const viewport = this.page.viewportSize()!;
      const titles = this.list().getByTestId(libraryOverviewCardTestIds.titleLink);
      for (let index = 0; index < (await titles.count()); index += 1) {
        const box = await titles.nth(index).boundingBox();
        if (box !== null && box.y > 120 && box.y + box.height < viewport.height - 40) {
          return { title: (await titles.nth(index).textContent()) ?? "", top: Math.round(box.y) };
        }
      }
      throw new Error("No library row's title is wholly on screen");
    });

  openTheRow = (title: string): Promise<ReaderPageObject> =>
    this.step(`openTheRow ${title}`, () =>
      new LibraryOverviewCardPageObject(
        this.testContext,
        this.get(libraryOverviewCardTestIds.root).filter({ hasText: title }),
      ).openReader(),
    );

  verifyRowIsAt = (row: { title: string; top: number }) =>
    this.step(`verifyRowIsAt ${row.title} ${row.top}`, async () => {
      const title = this.list().getByTestId(libraryOverviewCardTestIds.titleLink).filter({ hasText: row.title });
      await expect.poll(async () => Math.round((await title.boundingBox())?.y ?? Number.NaN), { timeout: 2_000 }).toBe(row.top);
    });

  tabPastTheLastRowInThePage = (): Promise<{ from: number; to: number }> =>
    this.step("tabPastTheLastRowInThePage", async () => {
      const last = this.list().getByRole("listitem").last();
      const from = Number(await last.getAttribute("aria-posinset"));
      await last.getByRole("button").last().focus();
      await this.page.keyboard.press("Tab");
      const to = await this.page.evaluate(() =>
        Number(document.activeElement?.closest("[role='listitem']")?.getAttribute("aria-posinset") ?? 0),
      );
      return { from, to };
    });

  private list = () => this.get(libraryPageTestIds.list);

  readScrollPosition = (): Promise<number> => this.step("readScrollPosition", () => this.page.evaluate(() => window.scrollY));

  verifyScrollPosition = (expected: number) =>
    this.step(`verifyScrollPosition ${expected}`, () =>
      expect.poll(() => this.page.evaluate(() => window.scrollY), { timeout: 2_000 }).toBe(expected),
    );

  get unreadableCard(): LibraryUnreadableCardPageObject {
    return new LibraryUnreadableCardPageObject(this.testContext);
  }

  verifyFilterCountReads = (count: string) =>
    this.step(`verifyFilterCountReads ${count}`, () => expect(this.get(libraryPageTestIds.rail).getByText(count)).toBeVisible());

  cardWithTitle = (title: string): LibraryOverviewCardPageObject =>
    new LibraryOverviewCardPageObject(this.testContext, this.get(libraryOverviewCardTestIds.root).filter({ hasText: title }));
}
