import { expect } from "@playwright/experimental-ct-react";
import type { NavigationDirection } from "../../src/util/viewTransitions.js";
import { appShellTestIds } from "../../src/shell/AppShell/AppShellTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { GenerateOverviewFormPageObject } from "./GenerateOverviewFormPageObject.testHelper.js";
import { GenerationStatusStripPageObject } from "./GenerationStatusStripPageObject.testHelper.js";
import { NewOverviewDialogPageObject } from "./NewOverviewDialogPageObject.testHelper.js";
import { SettingsPageObject } from "./SettingsPageObject.testHelper.js";

export class AppShellPageObject extends PageObject {
  get generateForm(): GenerateOverviewFormPageObject {
    return new GenerateOverviewFormPageObject(this.testContext);
  }

  get newOverviewDialog(): NewOverviewDialogPageObject {
    return new NewOverviewDialogPageObject(this.testContext);
  }

  get generationStatusStrip(): GenerationStatusStripPageObject {
    return new GenerationStatusStripPageObject(this.testContext);
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
      await this.expectToBeVisible(appShellTestIds.settingsLink);
      await this.expectNotToBeVisible(appShellTestIds.newOverviewButton);
      await expect(this.page.getByRole("navigation", { name: "Sections" })).toHaveCount(0);
    });

  verifyCarriesTheLibraryChrome = () =>
    this.step("verifyCarriesTheLibraryChrome", async () => {
      await this.expectToBeVisible(appShellTestIds.newOverviewButton);
      await expect(this.page.getByRole("navigation", { name: "Sections" })).toHaveCount(1);
    });

  clickBrand = () => this.step("clickBrand", () => this.click(appShellTestIds.brand));

  clickNewOverview = () =>
    this.step("clickNewOverview", () => this.click(appShellTestIds.newOverviewButton));

  openNewOverview = (): Promise<NewOverviewDialogPageObject> =>
    this.step("openNewOverview", async () => {
      await this.clickNewOverview();
      return this.newOverviewDialog.verifyIsShown();
    });

  openSettings = (): Promise<SettingsPageObject> =>
    this.step("openSettings", async () => {
      await this.click(appShellTestIds.settingsLink);
      return new SettingsPageObject(this.testContext).verifyIsShown();
    });
}
