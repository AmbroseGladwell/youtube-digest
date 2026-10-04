import { expect } from "@playwright/experimental-ct-react";
import { accountTermsLineTestIds } from "../../src/features/auth/components/AccountTermsLine/AccountTermsLineTestIds.js";
import { emailLinkFormTestIds } from "../../src/features/auth/components/EmailLinkForm/EmailLinkFormTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class AccountTermsLinePageObject extends PageObject {
  verifyReadsAboveTheButton = (origin: RegExp, opensElsewhere: boolean) =>
    this.step("verifyReadsAboveTheButton", async () => {
      const line = this.get(accountTermsLineTestIds.root);
      await expect(line).toHaveText(
        "By creating an account, you agree to the Terms and Privacy policy, including sharing which features you use. You can turn this off in Settings › Privacy.",
      );
      await expect(line.getByRole("checkbox")).toHaveCount(0);
      for (const [testId, page] of [
        [accountTermsLineTestIds.terms, "terms"],
        [accountTermsLineTestIds.privacy, "privacy"],
      ] as const) {
        await expect(this.get(testId)).toHaveAttribute("href", new RegExp(`${origin.source}/${page}$`));
        if (opensElsewhere) await expect(this.get(testId)).toHaveAttribute("target", "_blank");
        else await expect(this.get(testId)).not.toHaveAttribute("target");
      }
      const lineBottom = await line.evaluate((element) => element.getBoundingClientRect().bottom);
      const buttonTop = await this.get(emailLinkFormTestIds.submitButton).evaluate(
        (element) => element.getBoundingClientRect().top,
      );
      expect(buttonTop).toBeGreaterThan(lineBottom);
      expect(buttonTop - lineBottom).toBeLessThan(24);
    });

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectNotToBeVisible(accountTermsLineTestIds.root));
}
