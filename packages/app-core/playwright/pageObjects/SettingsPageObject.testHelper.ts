import { AppearanceSectionPageObject } from "./AppearanceSectionPageObject.testHelper.js";
import { PrivacySectionPageObject } from "./PrivacySectionPageObject.testHelper.js";
import { expect } from "@playwright/experimental-ct-react";
import { appShellTestIds } from "../../src/shell/AppShell/AppShellTestIds.js";
import { settingsPageTestIds } from "../../src/features/settings/SettingsPage/SettingsPageTestIds.js";
import type { SettingsSectionId } from "../../src/features/settings/SettingsSectionId.js";
import type { Plan } from "@overview/domain";
import { planUsageTestIds, type UsageRowId } from "../../src/features/plus/components/PlanUsage/PlanUsageTestIds.js";
import { planOfferCardTestIds } from "../../src/features/plus/components/PlanOfferCard/PlanOfferCardTestIds.js";
import { usagePanelTestIds } from "../../src/features/plus/components/UsagePanel/UsagePanelTestIds.js";
import { plusPlanPanelTestIds } from "../../src/features/plus/components/PlusPlanPanel/PlusPlanPanelTestIds.js";
import { buildLineTestIds } from "../../src/features/settings/components/BuildLine/BuildLineTestIds.js";
import { settingsSectionTestIds } from "../../src/features/settings/components/SettingsSection/SettingsSectionTestIds.js";
import { settingsSectionListTestIds } from "../../src/features/settings/components/SettingsSectionList/SettingsSectionListTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { ConnectionsSectionPageObject } from "./ConnectionsSectionPageObject.testHelper.js";
import { ModelPickerDialogPageObject } from "./ModelPickerDialogPageObject.testHelper.js";
import { PlaylistsSectionPageObject } from "./PlaylistsSectionPageObject.testHelper.js";
import { ApiKeysPanelPageObject } from "./ApiKeysPanelPageObject.testHelper.js";
import { NarrationVoicePickerPageObject } from "./NarrationVoicePickerPageObject.testHelper.js";
import { SharedLinksPanelPageObject } from "./SharedLinksPanelPageObject.testHelper.js";
import { SyncPanelPageObject } from "./SyncPanelPageObject.testHelper.js";
import { AccountTilePageObject } from "./AccountTilePageObject.testHelper.js";
import { syncPanelTestIds } from "../../src/features/sync/components/SyncPanel/SyncPanelTestIds.js";
import { MilestonesSectionPageObject } from "./MilestonesSectionPageObject.testHelper.js";
import { PersonalisationSectionPageObject } from "./PersonalisationSectionPageObject.testHelper.js";

export class SettingsPageObject extends PageObject {
  get apiKeysPanel(): ApiKeysPanelPageObject {
    return new ApiKeysPanelPageObject(this.testContext);
  }

  get modelPicker(): ModelPickerDialogPageObject {
    return new ModelPickerDialogPageObject(this.testContext);
  }

  get playlists(): PlaylistsSectionPageObject {
    return new PlaylistsSectionPageObject(this.testContext);
  }

  get connections(): ConnectionsSectionPageObject {
    return new ConnectionsSectionPageObject(this.testContext);
  }

  get privacySection(): PrivacySectionPageObject {
    return new PrivacySectionPageObject(this.testContext);
  }

  get syncPanel(): SyncPanelPageObject {
    return new SyncPanelPageObject(this.testContext);
  }

  get accountTile(): AccountTilePageObject {
    return new AccountTilePageObject(this.testContext, this.page.getByTestId(syncPanelTestIds.root));
  }

  get voicePicker(): NarrationVoicePickerPageObject {
    return new NarrationVoicePickerPageObject(this.testContext);
  }

  get appearance(): AppearanceSectionPageObject {
    return new AppearanceSectionPageObject(this.testContext);
  }

  get personalisation(): PersonalisationSectionPageObject {
    return new PersonalisationSectionPageObject(this.testContext);
  }

  get milestones(): MilestonesSectionPageObject {
    return new MilestonesSectionPageObject(this.testContext);
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

  verifySectionIntroIsAbsent = (section: SettingsSectionId) =>
    this.step(`verifySectionIntroIsAbsent ${section}`, () => this.expectToHaveCount(settingsSectionTestIds.intro(section), 0));

  verifySectionHeadingIsFocused = (section: SettingsSectionId) =>
    this.step(`verifySectionHeadingIsFocused ${section}`, () => expect(this.get(settingsSectionTestIds.heading(section))).toBeFocused());

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
      shown ? this.expectToBeVisible(settingsSectionListTestIds.root) : this.expectToHaveCount(settingsSectionListTestIds.root, 0),
    );

  clickBackToSettings = (): Promise<SettingsPageObject> =>
    this.step("clickBackToSettings", async () => {
      const inPage = this.page.getByTestId(settingsPageTestIds.settingsLink);
      // In the panel the page draws no link of its own and the bar holds it throughout.
      if ((await inPage.count()) > 0) {
        await inPage.click();
      } else {
        await this.page.getByTestId(appShellTestIds.backLink).click();
      }
      await this.verifyListIsShown(true);
      return this;
    });

  clickBackToOverviews = () => this.step("clickBackToOverviews", () => this.click(settingsPageTestIds.overviewsLink));

  recheckPlan = () => this.step("recheckPlan", () => this.click(plusPlanPanelTestIds.recheckButton));

  verifyPlanReads = (plan: string) =>
    this.step(`verifyPlanReads ${plan}`, () => expect(this.get(plusPlanPanelTestIds.planName)).toHaveText(plan));

  verifyPlanSummaryReads = (text: string) =>
    this.step(`verifyPlanSummaryReads ${text}`, () => expect(this.get(plusPlanPanelTestIds.summary)).toHaveText(text));

  seeUsage = () =>
    this.step("seeUsage", async () => {
      await this.click(plusPlanPanelTestIds.seeUsageLink);
      await expect(this.get(usagePanelTestIds.root)).toBeVisible();
    });

  verifyPlanCardsRead = (cards: Array<{ plan: Plan; lines: string[] }>) =>
    this.step(`verifyPlanCardsRead ${cards.map(({ plan }) => plan).join(", ")}`, async () => {
      for (const { plan, lines } of cards) {
        for (const line of lines) {
          await expect(this.get(planOfferCardTestIds.card(plan))).toContainText(line);
        }
      }
    });

  verifyPlanMarkedAsYours = (plan: Plan) =>
    this.step(`verifyPlanMarkedAsYours ${plan}`, async () => {
      const yours = this.get(plusPlanPanelTestIds.root).locator(`[data-testid^="plan-offer-"]`).filter({ hasText: "Your plan" });
      await expect(yours).toHaveCount(1);
      await expect(yours).toHaveAttribute("data-testid", planOfferCardTestIds.card(plan));
    });

  verifyTellMeWhenOffered = (plans: Plan[]) =>
    this.step(`verifyTellMeWhenOffered ${plans.join(", ")}`, async () => {
      for (const plan of ["free", "byo-plus", "plus"] as const) {
        await this.expectToHaveCount(planOfferCardTestIds.tellMeWhen(plan), plans.includes(plan) ? 1 : 0);
      }
    });

  verifyUsagePlanReads = (text: string) =>
    this.step(`verifyUsagePlanReads ${text}`, () => expect(this.get(usagePanelTestIds.yourPlan)).toHaveText(text));

  verifyUpgradeOffered = (offered: boolean) =>
    this.step(`verifyUpgradeOffered ${offered}`, () => this.expectToHaveCount(usagePanelTestIds.upgrade, offered ? 1 : 0));

  upgradePlan = () => this.step("upgradePlan", () => this.click(usagePanelTestIds.upgrade));

  verifyPlanUsagePeriodReads = (text: string) =>
    this.step(`verifyPlanUsagePeriodReads ${text}`, () => expect(this.get(planUsageTestIds.period)).toHaveText(text));

  verifyPlanUsageCellReads = (row: UsageRowId, lines: string[]) =>
    this.step(`verifyPlanUsageCellReads ${row} ${lines.join(" ")}`, () =>
      expect(this.get(planUsageTestIds.cell(row)).locator("dd:not([aria-hidden])")).toHaveText(lines),
    );

  verifyPlanUsageCellsAre = (quotas: Array<"ours" | "own">) =>
    this.step(`verifyPlanUsageCellsAre ${quotas.join(", ")}`, async () => {
      for (const quota of ["ours", "own"] as const) {
        await this.expectToHaveCount(planUsageTestIds.cell(quota), quotas.includes(quota) ? 1 : 0);
      }
    });

  verifyBuildLineReads = (text: string) =>
    this.step(`verifyBuildLineReads ${text}`, () => expect(this.get(buildLineTestIds.root)).toHaveText(text));
}
