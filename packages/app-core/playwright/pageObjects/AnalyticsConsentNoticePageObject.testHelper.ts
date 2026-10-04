import { expect } from "@playwright/experimental-ct-react";
import { analyticsConsentNoticeTestIds } from "../../src/features/analyticsConsent/components/AnalyticsConsentNotice/AnalyticsConsentNoticeTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class AnalyticsConsentNoticePageObject extends PageObject {
  verifyReads = (lead: string) =>
    this.step(`verifyReads ${lead}`, async () => {
      await expect(this.get(analyticsConsentNoticeTestIds.root)).toHaveAttribute("role", "status");
      await expect(this.get(analyticsConsentNoticeTestIds.lead)).toHaveText(lead);
      await expect(this.get(analyticsConsentNoticeTestIds.root)).toContainText("Change this any time in Settings › Privacy.");
      await expect(this.get(analyticsConsentNoticeTestIds.settingsLink)).toHaveAttribute("href", "/settings/privacy");
    });

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectNotToBeVisible(analyticsConsentNoticeTestIds.root));

  dismiss = () => this.step("dismiss", () => this.click(analyticsConsentNoticeTestIds.dismiss));
}
