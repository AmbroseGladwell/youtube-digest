import { expect } from "@playwright/experimental-ct-react";
import { libraryPageTestIds } from "../../src/features/library/LibraryPage/LibraryPageTestIds.js";
import { appShellTestIds } from "../../src/shell/AppShell/AppShellTestIds.js";
import { libraryOverviewCardTestIds } from "../../src/features/library/components/LibraryOverviewCard/LibraryOverviewCardTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { FilterPanelPageObject } from "./FilterPanelPageObject.testHelper.js";
import { GenerateOverviewFormPageObject } from "./GenerateOverviewFormPageObject.testHelper.js";
import { LibraryOverviewCardPageObject } from "./LibraryOverviewCardPageObject.testHelper.js";
import { LibraryUnreadableCardPageObject } from "./LibraryUnreadableCardPageObject.testHelper.js";
import { NewTopicDialogPageObject } from "./NewTopicDialogPageObject.testHelper.js";

export class LibraryPageObject extends PageObject {
  get filterPanel(): FilterPanelPageObject {
    return new FilterPanelPageObject(this.testContext);
  }

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
