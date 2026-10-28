import { expect } from "@playwright/experimental-ct-react";
import { signedOutGateTestIds } from "../../src/features/accountLibraries/components/SignedOutGate/SignedOutGateTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class SignedOutGatePageObject extends PageObject {
  verifyIsShown = () =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(signedOutGateTestIds.root);
      await expect(this.get(signedOutGateTestIds.root).getByRole("heading", { level: 1 })).toBeFocused();
    });

  verifyIsNotShown = () => this.step("verifyIsNotShown", () => this.expectNotToBeVisible(signedOutGateTestIds.root));

  verifyTitle = (title: string) =>
    this.step(`verifyTitle ${title}`, () =>
      expect(this.get(signedOutGateTestIds.root).getByRole("heading", { level: 1 })).toHaveText(title),
    );

  chooseSignIn = () => this.step("chooseSignIn", () => this.click(signedOutGateTestIds.signIn));

  chooseCreateAccount = () => this.step("chooseCreateAccount", () => this.click(signedOutGateTestIds.createAccount));
}
