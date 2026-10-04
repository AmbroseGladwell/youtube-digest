import { expect } from "@playwright/experimental-ct-react";
import { privacySectionTestIds } from "../../src/features/analyticsConsent/components/PrivacySection/PrivacySectionTestIds.js";
import { policyLinksTestIds } from "../../src/features/settings/components/PolicyLinks/PolicyLinksTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class PrivacySectionPageObject extends PageObject {
  verifySwitch = (on: boolean, status: string) =>
    this.step(`verifySwitch ${on} ${status}`, async () => {
      const toggle = this.page.getByRole("switch", { name: "Share usage" });
      await expect(toggle).toHaveAttribute("aria-checked", String(on));
      await expect(toggle).toHaveAccessibleDescription(status);
      await expect(this.get(privacySectionTestIds.status)).toHaveText(status);
    });

  verifyExplains = (text: string) =>
    this.step("verifyExplains", () => expect(this.get(privacySectionTestIds.explanation)).toHaveText(text));

  verifyErrorReportsAreApart = () =>
    this.step("verifyErrorReportsAreApart", async () => {
      await expect(this.get(privacySectionTestIds.errorReports)).toContainText(
        "Always sent, so we can fix what breaks. They never include what you watch, read or type, and Share usage doesn’t affect them.",
      );
      await expect(this.get(privacySectionTestIds.errorReports).getByRole("switch")).toHaveCount(0);
    });

  verifyPolicyLinks = (origin: RegExp, opensElsewhere: boolean) =>
    this.step("verifyPolicyLinks", async () => {
      for (const [testId, page] of [
        [policyLinksTestIds.privacy, "privacy"],
        [policyLinksTestIds.terms, "terms"],
      ] as const) {
        const link = this.get(testId);
        await expect(link).toHaveAttribute("href", new RegExp(`${origin.source}/${page}$`));
        if (opensElsewhere) await expect(link).toHaveAttribute("target", "_blank");
        else await expect(link).not.toHaveAttribute("target");
      }
    });

  switchShareUsage = () =>
    this.step("switchShareUsage", () => this.click(privacySectionTestIds.shareUsageSwitch));
}
