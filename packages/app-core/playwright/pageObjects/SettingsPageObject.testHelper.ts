import { expect } from "@playwright/experimental-ct-react";
import { settingsPageTestIds } from "../../src/features/settings/SettingsPage/SettingsPageTestIds.js";
import { plusPlanPanelTestIds } from "../../src/features/plus/components/PlusPlanPanel/PlusPlanPanelTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { ApiKeysPanelPageObject } from "./ApiKeysPanelPageObject.testHelper.js";

export class SettingsPageObject extends PageObject {
  get apiKeysPanel(): ApiKeysPanelPageObject {
    return new ApiKeysPanelPageObject(this.testContext);
  }

  verifyIsShown = (): Promise<SettingsPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(settingsPageTestIds.root);
      return this;
    });

  verifySavedConfirmation = () =>
    this.step("verifySavedConfirmation", () =>
      this.expectToBeVisible(settingsPageTestIds.savedConfirmation),
    );

  verifySeparateLibraryNote = () =>
    this.step("verifySeparateLibraryNote", () =>
      this.expectToBeVisible(settingsPageTestIds.separateLibraryNote),
    );

  verifyHasNoSeparateLibraryNote = () =>
    this.step("verifyHasNoSeparateLibraryNote", () =>
      this.expectNotToBeVisible(settingsPageTestIds.separateLibraryNote),
    );

  verifyPlanReads = (plan: string) =>
    this.step(`verifyPlanReads ${plan}`, () =>
      expect(this.get(plusPlanPanelTestIds.planName)).toHaveText(plan),
    );

  verifyPlusFeaturesRead = (features: string[]) =>
    this.step(`verifyPlusFeaturesRead ${features.join(", ")}`, () =>
      expect(this.get(plusPlanPanelTestIds.feature)).toHaveText(features),
    );

  verifyOffersPlus = (offers: boolean) =>
    this.step(`verifyOffersPlus ${offers}`, () =>
      offers
        ? this.expectToBeVisible(plusPlanPanelTestIds.offer)
        : this.expectNotToBeVisible(plusPlanPanelTestIds.offer),
    );

  verifySaysPlusIsNotOnSale = () =>
    this.step("verifySaysPlusIsNotOnSale", () =>
      this.expectToBeVisible(plusPlanPanelTestIds.notOnSaleNote),
    );

  clickBackToOverviews = () =>
    this.step("clickBackToOverviews", () => this.click(settingsPageTestIds.backLink));
}
