import { expect } from "@playwright/experimental-ct-react";
import { settingsPageTestIds } from "../../src/features/settings/SettingsPage/SettingsPageTestIds.js";
import { plusPlanPanelTestIds } from "../../src/features/plus/components/PlusPlanPanel/PlusPlanPanelTestIds.js";
import { buildLineTestIds } from "../../src/features/settings/components/BuildLine/BuildLineTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { narrationVoiceRowTestIds } from "../../src/features/settings/components/NarrationVoiceRow/NarrationVoiceRowTestIds.js";
import { ApiKeysPanelPageObject } from "./ApiKeysPanelPageObject.testHelper.js";
import { NarrationVoicePageObject } from "./NarrationVoicePageObject.testHelper.js";
import { NarrationVoicePickerPageObject } from "./NarrationVoicePickerPageObject.testHelper.js";
import { SyncPanelPageObject } from "./SyncPanelPageObject.testHelper.js";

export class SettingsPageObject extends PageObject {
  get apiKeysPanel(): ApiKeysPanelPageObject {
    return new ApiKeysPanelPageObject(this.testContext);
  }

  get syncPanel(): SyncPanelPageObject {
    return new SyncPanelPageObject(this.testContext);
  }

  get voicePicker(): NarrationVoicePickerPageObject {
    return new NarrationVoicePickerPageObject(this.testContext);
  }

  verifyVoiceRowReads = (text: string | RegExp) =>
    this.step(`verifyVoiceRowReads ${String(text)}`, () =>
      expect(this.get(narrationVoiceRowTestIds.root)).toHaveText(text),
    );

  openVoiceList = (): Promise<NarrationVoicePageObject> =>
    this.step("openVoiceList", async () => {
      await this.click(narrationVoiceRowTestIds.root);
      return new NarrationVoicePageObject(this.testContext).verifyIsShown();
    });

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

  verifyBuildLineReads = (text: string) =>
    this.step(`verifyBuildLineReads ${text}`, () => expect(this.get(buildLineTestIds.root)).toHaveText(text));

  verifyHasNoBuildLine = () =>
    this.step("verifyHasNoBuildLine", () => this.expectToHaveCount(buildLineTestIds.root, 0));

  clickBackToOverviews = () =>
    this.step("clickBackToOverviews", () => this.click(settingsPageTestIds.backLink));
}
