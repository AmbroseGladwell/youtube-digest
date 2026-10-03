import { expect } from "@playwright/experimental-ct-react";
import { signedOutLibraryTestIds } from "../../src/features/accountLibraries/components/SignedOutLibrary/SignedOutLibraryTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class SignedOutLibraryPageObject extends PageObject {
  verifyIsShown = () =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(signedOutLibraryTestIds.root);
      await expect(this.page.getByRole("heading", { name: "You’re signed out" })).toBeFocused();
    });

  verifyOffersAVideo = (offered: boolean) =>
    this.step(`verifyOffersAVideo ${offered}`, () =>
      offered
        ? this.expectToBeVisible(signedOutLibraryTestIds.urlInput)
        : this.expectNotToBeVisible(signedOutLibraryTestIds.urlInput),
    );

  chooseSignIn = () => this.step("chooseSignIn", () => this.click(signedOutLibraryTestIds.signIn));
}
