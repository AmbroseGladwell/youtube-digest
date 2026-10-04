import { expect } from "@playwright/experimental-ct-react";
import { analyticsConsentPromptTestIds } from "../../src/features/analyticsConsent/components/AnalyticsConsentPrompt/AnalyticsConsentPromptTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class AnalyticsConsentPromptPageObject extends PageObject {
  verifyAsksFirst = () =>
    this.step("verifyAsksFirst", async () => {
      const root = this.get(analyticsConsentPromptTestIds.root);
      await expect(root).toHaveAttribute("data-ask", "first");
      await expect(this.page.getByRole("region", { name: "Help improve The Overview?" })).toBeVisible();
      await expect(this.get(analyticsConsentPromptTestIds.body)).toHaveText(
        "Share which features you use, never what you watch, read or type. If you sign up later, this is linked to your account. Privacy policy",
      );
      await expect(this.get(analyticsConsentPromptTestIds.share)).toHaveText("Share usage");
      await expect(this.get(analyticsConsentPromptTestIds.dontShare)).toHaveText("Don’t share");
    });

  verifyPrivacyLink = (href: RegExp, opensElsewhere: boolean) =>
    this.step("verifyPrivacyLink", async () => {
      const link = this.get(analyticsConsentPromptTestIds.privacyLink);
      await expect(link).toHaveAttribute("href", href);
      if (opensElsewhere) await expect(link).toHaveAttribute("target", "_blank");
      else await expect(link).not.toHaveAttribute("target");
    });

  verifyAnswersLookAlike = () =>
    this.step("verifyAnswersLookAlike", async () => {
      const paint = (testId: string) =>
        this.get(testId).evaluate((button) => {
          const style = getComputedStyle(button);
          const { width, height } = button.getBoundingClientRect();
          return { background: style.backgroundColor, color: style.color, weight: style.fontWeight, width, height };
        });
      expect(await paint(analyticsConsentPromptTestIds.share)).toEqual(await paint(analyticsConsentPromptTestIds.dontShare));
    });

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectNotToBeVisible(analyticsConsentPromptTestIds.root));

  share = () => this.step("share", () => this.click(analyticsConsentPromptTestIds.share));

  dontShare = () => this.step("dontShare", () => this.click(analyticsConsentPromptTestIds.dontShare));
}
