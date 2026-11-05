import { expect } from "@playwright/experimental-ct-react";
import { authScreenTestIds } from "../../src/features/auth/components/AuthScreen/AuthScreenTestIds.js";
import { revertEmailPageTestIds } from "../../src/features/auth/RevertEmailPage/RevertEmailPageTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { SignInPageObject } from "./SignInPageObject.testHelper.js";

// Where the old address's "This wasn't me" button lands (docs/features/account-changes.md).
export class RevertEmailPageObject extends PageObject {
  verifyIsWorking = () => this.step("verifyIsWorking", () => this.expectToBeVisible(revertEmailPageTestIds.working));

  verifyIsDone = (email: string) =>
    this.step(`verifyIsDone ${email}`, async () => {
      await this.expectToBeVisible(revertEmailPageTestIds.done);
      await expect(this.get(revertEmailPageTestIds.email)).toHaveText(email);
      await expect(this.get(authScreenTestIds.title)).toBeFocused();
    });

  verifyIsRefused = (reason: string) =>
    this.step(`verifyIsRefused ${reason}`, async () => {
      await this.expectToBeVisible(revertEmailPageTestIds.refused);
      await expect(this.get(revertEmailPageTestIds.reason)).toHaveText(reason);
      await this.expectToHaveCount(revertEmailPageTestIds.signInButton, 0);
    });

  clickSignIn = (): Promise<SignInPageObject> =>
    this.step("clickSignIn", async () => {
      await this.click(revertEmailPageTestIds.signInButton);
      return new SignInPageObject(this.testContext).verifyAsksForEmail("Sign in");
    });
}
