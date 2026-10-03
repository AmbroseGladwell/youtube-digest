import { expect } from "@playwright/experimental-ct-react";
import { accountStripTestIds } from "../../src/features/accountLibraries/components/AccountStrip/AccountStripTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class AccountStripPageObject extends PageObject {
  verifySaysSignedOut = () =>
    this.step("verifySaysSignedOut", async () => {
      await expect(this.get(accountStripTestIds.root)).toHaveAttribute("data-kind", "signedOut");
      await expect(this.get(accountStripTestIds.root)).toContainText(
        "Signed out. Sign in to sync your Overviews and unlock more features.",
      );
      await expect(this.get(accountStripTestIds.action)).toHaveText("Sign in");
      await this.expectNotToBeVisible(accountStripTestIds.dismiss);
    });

  verifyOffersAnAccount = () =>
    this.step("verifyOffersAnAccount", async () => {
      await expect(this.get(accountStripTestIds.root)).toHaveAttribute("data-kind", "offer");
      await expect(this.get(accountStripTestIds.root)).toContainText(
        "Sync across devices. Create an account to keep your Overviews on every device and unlock more features.",
      );
      await expect(this.get(accountStripTestIds.action)).toHaveText("Create account");
    });

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectNotToBeVisible(accountStripTestIds.root));

  dismiss = () => this.step("dismiss", () => this.click(accountStripTestIds.dismiss));

  chooseAction = () => this.step("chooseAction", () => this.click(accountStripTestIds.action));
}
