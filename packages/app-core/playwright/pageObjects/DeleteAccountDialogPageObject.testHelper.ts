import { expect } from "@playwright/experimental-ct-react";
import { codeStepTestIds } from "../../src/features/auth/components/CodeStep/CodeStepTestIds.js";
import { deleteAccountDialogTestIds } from "../../src/features/auth/components/DeleteAccountDialog/DeleteAccountDialogTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

// Designs 184b–184d: the dialog's three steps and the failure after the last
// (docs/features/account-deletion.md).
export class DeleteAccountDialogPageObject extends PageObject {
  verifyExplains = (): Promise<DeleteAccountDialogPageObject> =>
    this.step("verifyExplains", async () => {
      await this.expectToBeVisible(deleteAccountDialogTestIds.root);
      await expect(this.get(deleteAccountDialogTestIds.heading)).toHaveText("Delete your account?");
      await expect(this.get(deleteAccountDialogTestIds.cancelButton)).toBeFocused();
      return this;
    });

  verifyBodyNames = (email: string) =>
    this.step(`verifyBodyNames ${email}`, () =>
      expect(this.get(deleteAccountDialogTestIds.body)).toHaveText(
        `Your account and everything in it are deleted straight away. This can’t be undone: signing in again with ${email} starts a new, empty account.`,
      ),
    );

  verifyListsWhatGoesAndStays = () =>
    this.step("verifyListsWhatGoesAndStays", async () => {
      await expect(this.get(deleteAccountDialogTestIds.deletedList).locator("li")).toHaveCount(7);
      await expect(this.get(deleteAccountDialogTestIds.deletedList)).toContainText("Your shared links, which stop working");
      await expect(this.get(deleteAccountDialogTestIds.keptList).locator("li")).toHaveCount(3);
      await expect(this.get(deleteAccountDialogTestIds.keptList)).toContainText("Overviews you made on this device before you signed in");
    });

  clickContinue = () => this.step("clickContinue", () => this.click(deleteAccountDialogTestIds.continueButton));

  verifyContinueIsOffered = (offered: boolean) =>
    this.step(`verifyContinueIsOffered ${offered}`, () =>
      offered
        ? this.expectToBeVisible(deleteAccountDialogTestIds.continueButton)
        : this.expectToHaveCount(deleteAccountDialogTestIds.continueButton, 0),
    );

  verifyRefusedReads = (pattern: RegExp) =>
    this.step(`verifyRefusedReads ${pattern.source}`, () => expect(this.get(deleteAccountDialogTestIds.refused)).toHaveText(pattern));

  clickCancel = () => this.step("clickCancel", () => this.click(deleteAccountDialogTestIds.cancelButton));

  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));

  verifyIsClosed = () => this.step("verifyIsClosed", () => this.expectToHaveCount(deleteAccountDialogTestIds.root, 0));

  // The code step, 14i's box inside the dialog.

  verifyAsksForCode = (email: string) =>
    this.step(`verifyAsksForCode ${email}`, async () => {
      await expect(this.get(codeStepTestIds.heading)).toHaveText("Confirm it’s you");
      await expect(this.get(codeStepTestIds.heading)).toBeFocused();
      await expect(this.get(deleteAccountDialogTestIds.root)).toContainText(`We sent a code to ${email}. Enter it to delete your account.`);
      await expect(this.get(codeStepTestIds.submitButton)).toHaveText("Delete my account");
    });

  verifyResendIsCountingDown = () =>
    this.step("verifyResendIsCountingDown", () => expect(this.get(codeStepTestIds.countdown)).toHaveText(/^Send a new code in \d:\d\d$/));

  enterCode = (code: string) =>
    this.step(`enterCode ${code}`, async () => {
      await this.get(codeStepTestIds.codeInput).fill(code);
      await this.click(codeStepTestIds.submitButton);
    });

  verifyCodeErrorReads = (text: string) =>
    this.step(`verifyCodeErrorReads ${text}`, async () => {
      await expect(this.get(codeStepTestIds.error)).toHaveText(text);
      await expect(this.get(codeStepTestIds.codeInput)).toBeFocused();
    });

  clickCancelCode = () => this.step("clickCancelCode", () => this.click(codeStepTestIds.cancelButton));

  // Deleting, and when it can't.

  verifyIsDeleting = () =>
    this.step("verifyIsDeleting", async () => {
      await expect(this.get(deleteAccountDialogTestIds.heading)).toHaveText("Deleting your account…");
      await this.expectToHaveCount(deleteAccountDialogTestIds.cancelButton, 0);
      await this.expectToHaveCount(deleteAccountDialogTestIds.closeButton, 0);
    });

  verifyFailed = () =>
    this.step("verifyFailed", async () => {
      await expect(this.get(deleteAccountDialogTestIds.heading)).toHaveText("Your account wasn’t deleted");
      await expect(this.get(deleteAccountDialogTestIds.heading)).toBeFocused();
      await expect(this.get(deleteAccountDialogTestIds.failed)).toHaveText(
        "Something went wrong on our side, so nothing was deleted and you’re still signed in.",
      );
    });

  clickTryAgain = () => this.step("clickTryAgain", () => this.click(deleteAccountDialogTestIds.tryAgainButton));
}
