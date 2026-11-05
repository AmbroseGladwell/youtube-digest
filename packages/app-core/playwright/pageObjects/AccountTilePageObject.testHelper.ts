import { expect } from "@playwright/experimental-ct-react";
import { accountTileTestIds } from "../../src/features/auth/components/AccountTile/AccountTileTestIds.js";
import { codeStepTestIds } from "../../src/features/auth/components/CodeStep/CodeStepTestIds.js";
import { emailChangeFlowTestIds } from "../../src/features/auth/components/EmailChangeFlow/EmailChangeFlowTestIds.js";
import { nameEditorTestIds } from "../../src/features/auth/components/NameEditor/NameEditorTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

// The "Signed in as" tile in Settings › Account & sync: the name and the email, and every
// step of changing either (docs/features/account-changes.md).
export class AccountTilePageObject extends PageObject {
  verifyIsShown = (): Promise<AccountTilePageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(accountTileTestIds.root);
      return this;
    });

  verifyNameReads = (name: string) =>
    this.step(`verifyNameReads ${name}`, () => expect(this.get(accountTileTestIds.nameValue)).toHaveText(name));

  verifyEmailReads = (email: string) =>
    this.step(`verifyEmailReads ${email}`, () => expect(this.get(accountTileTestIds.emailValue)).toHaveText(email));

  verifyChangeNameReads = (label: string) =>
    this.step(`verifyChangeNameReads ${label}`, () => expect(this.get(accountTileTestIds.changeNameButton)).toHaveText(label));

  verifyOffersChangingEmail = (offers: boolean) =>
    this.step(`verifyOffersChangingEmail ${offers}`, () =>
      offers
        ? this.expectToBeVisible(accountTileTestIds.changeEmailButton)
        : this.expectToHaveCount(accountTileTestIds.changeEmailButton, 0),
    );

  // The name.

  clickChangeName = () => this.step("clickChangeName", () => this.click(accountTileTestIds.changeNameButton));

  verifyNameFieldHasFocusAndSelection = (name: string) =>
    this.step(`verifyNameFieldHasFocusAndSelection ${name}`, async () => {
      const field = this.get(nameEditorTestIds.input);
      await expect(field).toBeFocused();
      await expect(field).toHaveValue(name);
      const selected = await field.evaluate((element) => {
        const input = element as HTMLInputElement;
        return input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0);
      });
      expect(selected).toBe(name);
    });

  typeName = (name: string) => this.step(`typeName ${name}`, () => this.get(nameEditorTestIds.input).fill(name));

  verifyNameHintReads = (text: string) =>
    this.step(`verifyNameHintReads ${text}`, () => expect(this.get(nameEditorTestIds.hint)).toHaveText(text));

  verifyNameErrorReads = (text: string) =>
    this.step(`verifyNameErrorReads ${text}`, () => expect(this.get(nameEditorTestIds.error)).toHaveText(text));

  clickSaveName = () => this.step("clickSaveName", () => this.click(nameEditorTestIds.saveButton));

  clickCancelName = () => this.step("clickCancelName", () => this.click(nameEditorTestIds.cancelButton));

  verifyNameStatusReads = (pattern: RegExp) =>
    this.step(`verifyNameStatusReads ${pattern.source}`, () =>
      expect(this.get(accountTileTestIds.nameStatus)).toHaveText(pattern),
    );

  // The email.

  clickChangeEmail = () => this.step("clickChangeEmail", () => this.click(accountTileTestIds.changeEmailButton));

  verifyCodeStepReads = (heading: "Confirm it’s you" | "Enter the code") =>
    this.step(`verifyCodeStepReads ${heading}`, async () => {
      await expect(this.get(codeStepTestIds.heading)).toHaveText(heading);
      await expect(this.get(codeStepTestIds.heading)).toBeFocused();
    });

  verifyCodeStepIsAbsent = () => this.step("verifyCodeStepIsAbsent", () => this.expectToHaveCount(codeStepTestIds.root, 0));

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

  verifyCodeStatusReads = (text: string) =>
    this.step(`verifyCodeStatusReads ${text}`, () => expect(this.get(codeStepTestIds.status)).toHaveText(text));

  verifyCodeSubmitIsOffered = (offered: boolean) =>
    this.step(`verifyCodeSubmitIsOffered ${offered}`, () =>
      offered ? this.expectToBeVisible(codeStepTestIds.submitButton) : this.expectToHaveCount(codeStepTestIds.submitButton, 0),
    );

  verifyResendIsCountingDown = () =>
    this.step("verifyResendIsCountingDown", () => expect(this.get(codeStepTestIds.countdown)).toHaveText(/^Send a new code in \d:\d\d$/));

  verifyResendIsOffered = (offered: boolean) =>
    this.step(`verifyResendIsOffered ${offered}`, () =>
      offered
        ? expect(this.get(codeStepTestIds.resendButton).or(this.get(codeStepTestIds.countdown))).toBeVisible()
        : this.expectToHaveCount(codeStepTestIds.resendButton, 0),
    );

  clickResend = () => this.step("clickResend", () => this.click(codeStepTestIds.resendButton));

  clickCancelCode = () => this.step("clickCancelCode", () => this.click(codeStepTestIds.cancelButton));

  clickUseDifferentAddress = () =>
    this.step("clickUseDifferentAddress", () =>
      this.click(this.get(codeStepTestIds.differentAddressButton).or(this.get(emailChangeFlowTestIds.takenDifferentAddressButton))),
    );

  verifyAsksForNewEmail = () =>
    this.step("verifyAsksForNewEmail", async () => {
      await this.expectToBeVisible(emailChangeFlowTestIds.newEmailInput);
      await expect(this.get(emailChangeFlowTestIds.newEmailInput)).toBeFocused();
    });

  requestCode = (email: string) =>
    this.step(`requestCode ${email}`, async () => {
      await this.get(emailChangeFlowTestIds.newEmailInput).fill(email);
      await this.click(emailChangeFlowTestIds.sendCodeButton);
    });

  verifyNewEmailErrorReads = (text: string | RegExp) =>
    this.step(`verifyNewEmailErrorReads ${String(text)}`, () => expect(this.get(emailChangeFlowTestIds.newEmailError)).toHaveText(text));

  verifySendCodeIsOffered = (offered: boolean) =>
    this.step(`verifySendCodeIsOffered ${offered}`, () =>
      offered
        ? this.expectToBeVisible(emailChangeFlowTestIds.sendCodeButton)
        : this.expectToHaveCount(emailChangeFlowTestIds.sendCodeButton, 0),
    );

  clickCancelNewEmail = () => this.step("clickCancelNewEmail", () => this.click(emailChangeFlowTestIds.cancelButton));

  verifyTakenReads = (text: string) =>
    this.step(`verifyTakenReads ${text}`, () => expect(this.get(emailChangeFlowTestIds.taken)).toHaveText(text));

  verifyEmailStatusReads = (pattern: RegExp) =>
    this.step(`verifyEmailStatusReads ${pattern.source}`, () =>
      expect(this.get(accountTileTestIds.emailStatus)).toHaveText(pattern),
    );

  verifyFlowIsClosed = () => this.step("verifyFlowIsClosed", () => this.expectToHaveCount(emailChangeFlowTestIds.root, 0));
}
