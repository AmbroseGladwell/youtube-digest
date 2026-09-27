import { expect } from "@playwright/experimental-ct-react";
import { signInPageTestIds } from "../../src/features/auth/SignInPage/SignInPageTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class SignInPageObject extends PageObject {
  verifyIsShown = (): Promise<SignInPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(signInPageTestIds.root);
      return this;
    });

  verifyShowsCode = (code: string) =>
    this.step(`verifyShowsCode ${code}`, async () => {
      await expect(this.get(signInPageTestIds.linkCode)).toHaveText(code);
      await this.expectToBeVisible(signInPageTestIds.linkCodeNote);
    });
}
