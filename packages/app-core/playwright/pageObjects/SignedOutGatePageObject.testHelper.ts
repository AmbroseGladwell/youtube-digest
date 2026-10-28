import { expect } from "@playwright/experimental-ct-react";
import { signedOutGateTestIds } from "../../src/features/accountLibraries/components/SignedOutGate/SignedOutGateTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class SignedOutGatePageObject extends PageObject {
  verifyIsShown = () =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(signedOutGateTestIds.root);
      await expect(this.page.getByRole("heading", { name: "Your overviews need an account" })).toBeFocused();
    });

  verifyIsNotShown = () => this.step("verifyIsNotShown", () => this.expectNotToBeVisible(signedOutGateTestIds.root));

  chooseSignIn = () => this.step("chooseSignIn", () => this.click(signedOutGateTestIds.signIn));

  chooseCreateAccount = () => this.step("chooseCreateAccount", () => this.click(signedOutGateTestIds.createAccount));
}
