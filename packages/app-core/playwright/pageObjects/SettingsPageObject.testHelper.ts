import { expect } from "@playwright/experimental-ct-react";
import { settingsPageTestIds } from "../../src/features/settings/SettingsPage/SettingsPageTestIds.js";
import type { SettingsSectionId } from "../../src/features/settings/SettingsSectionId.js";
import { plusPlanPanelTestIds } from "../../src/features/plus/components/PlusPlanPanel/PlusPlanPanelTestIds.js";
import { apiKeysSectionTestIds } from "../../src/features/settings/components/ApiKeysSection/ApiKeysSectionTestIds.js";
import { buildLineTestIds } from "../../src/features/settings/components/BuildLine/BuildLineTestIds.js";
import { settingsSectionTestIds } from "../../src/features/settings/components/SettingsSection/SettingsSectionTestIds.js";
import { settingsSectionListTestIds } from "../../src/features/settings/components/SettingsSectionList/SettingsSectionListTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { ConnectionsSectionPageObject } from "./ConnectionsSectionPageObject.testHelper.js";
import { ApiKeysPanelPageObject } from "./ApiKeysPanelPageObject.testHelper.js";
import { NarrationVoicePickerPageObject } from "./NarrationVoicePickerPageObject.testHelper.js";
import { SharedLinksPanelPageObject } from "./SharedLinksPanelPageObject.testHelper.js";
import { SyncPanelPageObject } from "./SyncPanelPageObject.testHelper.js";

export class SettingsPageObject extends PageObject {
  get apiKeysPanel(): ApiKeysPanelPageObject {
    return new ApiKeysPanelPageObject(this.testContext);
  }

  get connections(): ConnectionsSectionPageObject {
    return new ConnectionsSectionPageObject(this.testContext);
  }

  get syncPanel(): SyncPanelPageObject {
    return new SyncPanelPageObject(this.testContext);
  }

  get voicePicker(): NarrationVoicePickerPageObject {
    return new NarrationVoicePickerPageObject(this.testContext);
  }

  get sharedLinks(): SharedLinksPanelPageObject {
    return new SharedLinksPanelPageObject(this.testContext);
  }

  verifyIsShown = (): Promise<SettingsPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(settingsPageTestIds.root);
      return this;
    });

  openSection = (section: SettingsSectionId): Promise<SettingsPageObject> =>
    this.step(`openSection ${section}`, async () => {
      await this.click(settingsSectionListTestIds.row(section));
      await this.verifySectionIsShown(section);
      return this;
    });

  verifySectionIsShown = (section: SettingsSectionId) =>
    this.step(`verifySectionIsShown ${section}`, () => this.expectToBeVisible(settingsSectionTestIds.root(section)));

  verifySectionIsAbsent = (section: SettingsSectionId) =>
    this.step(`verifySectionIsAbsent ${section}`, () => this.expectToHaveCount(settingsSectionTestIds.root(section), 0));

  verifySectionHeadingIsFocused = (section: SettingsSectionId) =>
    this.step(`verifySectionHeadingIsFocused ${section}`, () =>
      expect(this.get(settingsSectionTestIds.heading(section))).toBeFocused(),
    );

  verifyRowsAre = (sections: SettingsSectionId[]) =>
    this.step(`verifyRowsAre ${sections.join(", ")}`, () =>
      expect
        .poll(() =>
          this.get(settingsSectionListTestIds.root)
            .getByRole("link")
            .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-testid"))),
        )
        .toEqual(sections.map((section) => settingsSectionListTestIds.row(section))),
    );

  verifyRowReads = (section: SettingsSectionId, text: string | RegExp) =>
    this.step(`verifyRowReads ${section} ${String(text)}`, () =>
      expect(this.get(settingsSectionListTestIds.rowValue(section))).toHaveText(text),
    );

  verifyCurrentRow = (section: SettingsSectionId) =>
    this.step(`verifyCurrentRow ${section}`, () =>
      expect(this.get(settingsSectionListTestIds.row(section))).toHaveAttribute("aria-current", "page"),
    );

  verifyListIsShown = (shown: boolean) =>
    this.step(`verifyListIsShown ${shown}`, () =>
      shown
        ? this.expectToBeVisible(settingsSectionListTestIds.root)
        : this.expectToHaveCount(settingsSectionListTestIds.root, 0),
    );

  clickBackToSettings = (): Promise<SettingsPageObject> =>
    this.step("clickBackToSettings", async () => {
      await this.click(settingsPageTestIds.settingsLink);
      await this.verifyListIsShown(true);
      return this;
    });

  clickBackToOverviews = () =>
    this.step("clickBackToOverviews", () => this.click(settingsPageTestIds.overviewsLink));

  verifySavedConfirmation = () =>
    this.step("verifySavedConfirmation", () => this.expectToBeVisible(apiKeysSectionTestIds.savedConfirmation));

  recheckPlan = () => this.step("recheckPlan", () => this.click(plusPlanPanelTestIds.recheckButton));

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
}
