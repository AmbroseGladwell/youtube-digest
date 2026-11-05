import { expect } from "@playwright/experimental-ct-react";
import type { NavigationDirection } from "../../src/util/viewTransitions.js";
import { appShellTestIds } from "../../src/shell/AppShell/AppShellTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { AccountMenuPageObject } from "./AccountMenuPageObject.testHelper.js";
import { GenerateOverviewFormPageObject } from "./GenerateOverviewFormPageObject.testHelper.js";
import { GenerationStatusStripPageObject } from "./GenerationStatusStripPageObject.testHelper.js";
import { NewOverviewDialogPageObject } from "./NewOverviewDialogPageObject.testHelper.js";
import { SettingsPageObject } from "./SettingsPageObject.testHelper.js";
import { StaleClientBannerPageObject } from "./StaleClientBannerPageObject.testHelper.js";
import { ErrorStatePageObject } from "./ErrorStatePageObject.testHelper.js";
import { CaptureQueueStripPageObject } from "./CaptureQueueStripPageObject.testHelper.js";
import { PlaylistFollowFlowPageObject } from "./PlaylistFollowFlowPageObject.testHelper.js";
import { QueuePageObject } from "./QueuePageObject.testHelper.js";
import { LibraryPageObject } from "./LibraryPageObject.testHelper.js";

export class AppShellPageObject extends PageObject {
  get accountMenu(): AccountMenuPageObject {
    return new AccountMenuPageObject(this.testContext, this.get(appShellTestIds.masthead));
  }

  get generateForm(): GenerateOverviewFormPageObject {
    return new GenerateOverviewFormPageObject(this.testContext);
  }

  get newOverviewDialog(): NewOverviewDialogPageObject {
    return new NewOverviewDialogPageObject(this.testContext);
  }

  get generationStatusStrip(): GenerationStatusStripPageObject {
    return new GenerationStatusStripPageObject(this.testContext);
  }

  get queueStrip(): CaptureQueueStripPageObject {
    return new CaptureQueueStripPageObject(this.testContext);
  }

  get playlistFlow(): PlaylistFollowFlowPageObject {
    return new PlaylistFollowFlowPageObject(this.testContext);
  }

  get queuePage(): QueuePageObject {
    return new QueuePageObject(this.testContext);
  }

  get staleClientBanner(): StaleClientBannerPageObject {
    return new StaleClientBannerPageObject(this.testContext);
  }

  // The wall stands in for the pane, so it is the shell's to find
  // (docs/features/record-migrations.md, "Below the write floor is a wall").
  get writeFloorWall(): ErrorStatePageObject {
    return new ErrorStatePageObject(this.testContext, this.get(appShellTestIds.pane));
  }

  // paneTransitions.scss is a stylesheet and can't be asserted on, but it keys every rule
  // off this one attribute, so this is where the way in and the way back are actually held.
  verifyNavigationDirection = (direction: NavigationDirection) =>
    this.step(`verifyNavigationDirection ${direction}`, () =>
      expect(this.page.locator("html")).toHaveAttribute("data-nav-direction", direction),
    );

  verifyIsParedBackToThePanel = () =>
    this.step("verifyIsParedBackToThePanel", async () => {
      await this.expectToBeVisible(appShellTestIds.brand);
      await expect(this.page.getByRole("button", { name: "Account" })).toBeVisible();
      await this.expectNotToBeVisible(appShellTestIds.newOverviewButton);
      await expect(this.page.getByRole("navigation", { name: "Sections" })).toHaveCount(0);
    });

  verifyNewOverviewButtonIsAbsent = () =>
    this.step("verifyNewOverviewButtonIsAbsent", () => this.expectNotToBeVisible(appShellTestIds.newOverviewButton));

  verifyCarriesTheLibraryChrome = () =>
    this.step("verifyCarriesTheLibraryChrome", async () => {
      await this.expectToBeVisible(appShellTestIds.newOverviewButton);
      await expect(this.page.getByRole("navigation", { name: "Sections" })).toHaveCount(1);
    });

  clickBrand = () => this.step("clickBrand", () => this.click(appShellTestIds.brand));

  // Design OV-167: one slot, two links, and only the one shown reaches the keyboard or a
  // screen reader. Both are named "All overviews", so the count of reachable links with
  // that name is what says whose turn it is (docs/features/back-within-reach.md).
  verifyBarHoldsTheBrand = () =>
    this.step("verifyBarHoldsTheBrand", async () => {
      await expect(this.get(appShellTestIds.brand)).not.toHaveAttribute("inert");
      await expect(this.get(appShellTestIds.backLink)).toHaveAttribute("inert", "");
      await expect(this.page.getByRole("link", { name: "All overviews" })).toHaveCount(1);
    });

  verifyBarHoldsTheWayBack = () =>
    this.step("verifyBarHoldsTheWayBack", async () => {
      await expect(this.get(appShellTestIds.backLink)).not.toHaveAttribute("inert");
      await expect(this.get(appShellTestIds.brand)).toHaveAttribute("inert", "");
      await expect(this.page.getByRole("link", { name: "All overviews" })).toHaveCount(2);
    });

  verifyBarKeepsHoldingTheWayBack = (forMs: number) =>
    this.step(`verifyBarKeepsHoldingTheWayBack ${forMs}`, async () => {
      const swaps = await this.page.evaluate(
        ([testId, ms]) =>
          new Promise<number>((resolve) => {
            const link = document.querySelector(`[data-testid="${testId}"]`)!;
            let count = 0;
            const observer = new MutationObserver(() => {
              count += 1;
            });
            observer.observe(link, { attributes: true, attributeFilter: ["inert"] });
            setTimeout(() => {
              observer.disconnect();
              resolve(count);
            }, ms);
          }),
        [appShellTestIds.backLink, forMs] as const,
      );
      expect(swaps).toBe(0);
    });

  verifyBarNeverOffersTheWayBack = () =>
    this.step("verifyBarNeverOffersTheWayBack", async () => {
      await this.expectToHaveCount(appShellTestIds.backLink, 0);
      await expect(this.get(appShellTestIds.brand)).not.toHaveAttribute("inert");
    });

  // Tapped where it is: a locator click would first scroll the stuck bar "into view", which
  // is the top of the page, and the head's own link coming back would hand the slot back.
  clickBackInBar = (): Promise<LibraryPageObject> =>
    this.step("clickBackInBar", async () => {
      await expect
        .poll(() =>
          this.page.evaluate(() =>
            document.getAnimations().some((animation) => {
              const effect = animation.effect;
              return effect instanceof KeyframeEffect && (effect.pseudoElement ?? "").startsWith("::view-transition");
            }),
          ),
        )
        .toBe(false);
      const box = (await this.get(appShellTestIds.backLink).boundingBox())!;
      await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      return new LibraryPageObject(this.testContext).verifyIsShown();
    });

  clickNewOverview = () =>
    this.step("clickNewOverview", () => this.click(appShellTestIds.newOverviewButton));

  openNewOverview = (): Promise<NewOverviewDialogPageObject> =>
    this.step("openNewOverview", async () => {
      await this.clickNewOverview();
      return this.newOverviewDialog.verifyIsShown();
    });

  openSettings = (): Promise<SettingsPageObject> =>
    this.step("openSettings", async () => {
      const menu = await this.accountMenu.open();
      return menu.chooseSettings();
    });

  verifyOffersNotNow = (offers: boolean) =>
    this.step(`verifyOffersNotNow ${offers}`, () =>
      offers
        ? this.expectToBeVisible(appShellTestIds.notNowLink)
        : this.expectNotToBeVisible(appShellTestIds.notNowLink),
    );

  clickNotNow = () => this.step("clickNotNow", () => this.click(appShellTestIds.notNowLink));
}
