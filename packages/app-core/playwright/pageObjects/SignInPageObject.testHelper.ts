import { expect } from "@playwright/experimental-ct-react";
import { authScreenTestIds } from "../../src/features/auth/components/AuthScreen/AuthScreenTestIds.js";
import { checkEmailTestIds } from "../../src/features/auth/components/CheckEmail/CheckEmailTestIds.js";
import { emailLinkFormTestIds } from "../../src/features/auth/components/EmailLinkForm/EmailLinkFormTestIds.js";
import { enterCodeTestIds } from "../../src/features/auth/components/EnterCode/EnterCodeTestIds.js";
import { linkCodeCardTestIds } from "../../src/features/auth/components/LinkCodeCard/LinkCodeCardTestIds.js";
import { requestLinkFlowTestIds } from "../../src/features/auth/components/RequestLinkFlow/RequestLinkFlowTestIds.js";
import { resendLinkButtonTestIds } from "../../src/features/auth/components/ResendLinkButton/ResendLinkButtonTestIds.js";
import { signedInWelcomeTestIds } from "../../src/features/auth/components/SignedInWelcome/SignedInWelcomeTestIds.js";
import { signInPageTestIds } from "../../src/features/auth/SignInPage/SignInPageTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

// Every step of signing in and creating an account: /sign-in and /create-account are the
// one flow with a different first screen (docs/features/sign-in.md).
export class SignInPageObject extends PageObject {
  verifyAsksForEmail = (title: "Sign in" | "Create your account" | "That link has expired"): Promise<SignInPageObject> =>
    this.step(`verifyAsksForEmail ${title}`, async () => {
      await this.expectToBeVisible(requestLinkFlowTestIds.root);
      await expect(this.get(authScreenTestIds.title)).toHaveText(title);
      return this;
    });

  verifyLeadReads = (pattern: RegExp) =>
    this.step(`verifyLeadReads ${pattern.source}`, () => expect(this.get(authScreenTestIds.lead)).toHaveText(pattern));

  verifySavedOverviewsNoteReads = (text: string | null) =>
    this.step(`verifySavedOverviewsNoteReads ${text}`, () =>
      text === null
        ? this.expectToHaveCount(emailLinkFormTestIds.savedOverviewsNote, 0)
        : expect(this.get(emailLinkFormTestIds.savedOverviewsNote)).toHaveText(text),
    );

  verifyAsksForServer = (asks: boolean) =>
    this.step(`verifyAsksForServer ${asks}`, () =>
      asks
        ? this.expectToBeVisible(emailLinkFormTestIds.serverInput)
        : this.expectToHaveCount(emailLinkFormTestIds.serverInput, 0),
    );

  chooseOtherServer = (apiUrl: string) =>
    this.step(`chooseOtherServer ${apiUrl}`, async () => {
      await this.click(emailLinkFormTestIds.otherServerButton);
      await this.get(emailLinkFormTestIds.serverInput).fill(apiUrl);
    });

  setServerAddress = (apiUrl: string) =>
    this.step(`setServerAddress ${apiUrl}`, () => this.get(emailLinkFormTestIds.serverInput).fill(apiUrl));

  typeFirstName = (firstName: string) =>
    this.step(`typeFirstName ${firstName}`, () => this.get(emailLinkFormTestIds.firstNameInput).fill(firstName));

  requestLink = (email: string) =>
    this.step(`requestLink ${email}`, async () => {
      await this.get(emailLinkFormTestIds.emailInput).fill(email);
      await this.click(emailLinkFormTestIds.submitButton);
    });

  verifyFieldErrorReads = (text: string) =>
    this.step(`verifyFieldErrorReads ${text}`, () => expect(this.get(emailLinkFormTestIds.fieldError)).toHaveText(text));

  switchToOtherPage = (): Promise<SignInPageObject> =>
    this.step("switchToOtherPage", async () => {
      await this.click(requestLinkFlowTestIds.switchLink);
      return this;
    });

  verifyChecksEmail = (email: string) =>
    this.step(`verifyChecksEmail ${email}`, async () => {
      await this.expectToBeVisible(checkEmailTestIds.root);
      await expect(this.get(checkEmailTestIds.email)).toHaveText(email);
    });

  verifyKickerReads = (text: string) =>
    this.step(`verifyKickerReads ${text}`, () => expect(this.get(authScreenTestIds.kicker)).toHaveText(text));

  verifyHeadingHasFocus = () =>
    this.step("verifyHeadingHasFocus", () => expect(this.get(authScreenTestIds.title)).toBeFocused());

  useDifferentEmail = () =>
    this.step("useDifferentEmail", () =>
      this.locatorOrPage()
        .getByTestId(checkEmailTestIds.differentEmailButton)
        .or(this.get(enterCodeTestIds.differentEmailButton))
        .click(),
    );

  verifyResendWaitReads = (text: string) =>
    this.step(`verifyResendWaitReads ${text}`, () =>
      expect(this.get(resendLinkButtonTestIds.countdown)).toHaveText(text),
    );

  resend = () => this.step("resend", () => this.click(resendLinkButtonTestIds.button));

  verifyAsksForCode = (email: string) =>
    this.step(`verifyAsksForCode ${email}`, async () => {
      await this.expectToBeVisible(enterCodeTestIds.root);
      await expect(this.get(enterCodeTestIds.email)).toHaveText(email);
    });

  enterCode = (code: string) =>
    this.step(`enterCode ${code}`, async () => {
      await this.get(enterCodeTestIds.codeInput).fill(code);
      await this.click(enterCodeTestIds.connectButton);
    });

  verifyCodeErrorReads = (pattern: RegExp) =>
    this.step(`verifyCodeErrorReads ${pattern.source}`, () => expect(this.get(enterCodeTestIds.error)).toHaveText(pattern));

  verifyWelcomes = (title: string, lead: RegExp) =>
    this.step(`verifyWelcomes ${title}`, async () => {
      await this.expectToBeVisible(signedInWelcomeTestIds.root);
      await expect(this.get(authScreenTestIds.title)).toHaveText(title);
      await expect(this.get(authScreenTestIds.lead)).toHaveText(lead);
    });

  clickDone = () => this.step("clickDone", () => this.click(signedInWelcomeTestIds.doneButton));

  verifyIsSigningIn = () => this.step("verifyIsSigningIn", () => this.expectToBeVisible(signInPageTestIds.working));

  verifyShowsCode = (code: string) =>
    this.step(`verifyShowsCode ${code}`, async () => {
      await expect(this.get(linkCodeCardTestIds.code)).toHaveText(code);
      await this.expectToBeVisible(linkCodeCardTestIds.staysSignedOutNote);
    });

  verifyShowsCodeForExtension = (code: string) =>
    this.step(`verifyShowsCodeForExtension ${code}`, async () => {
      await expect(this.get(linkCodeCardTestIds.code)).toHaveText(code);
      await this.expectToBeVisible(linkCodeCardTestIds.sameAccountNote);
      await this.expectToHaveCount(linkCodeCardTestIds.staysSignedOutNote, 0);
    });

  askForNewCode = () => this.step("askForNewCode", () => this.click(linkCodeCardTestIds.newCodeButton));

  verifyOffersCodeFromWebApp = (offers: boolean) =>
    this.step(`verifyOffersCodeFromWebApp ${offers}`, () =>
      offers
        ? this.expectToBeVisible(requestLinkFlowTestIds.webAppCodeButton)
        : this.expectToHaveCount(requestLinkFlowTestIds.webAppCodeButton, 0),
    );

  chooseCodeFromWebApp = () =>
    this.step("chooseCodeFromWebApp", async () => {
      await this.click(requestLinkFlowTestIds.webAppCodeButton);
      await this.expectToBeVisible(enterCodeTestIds.root);
      await this.expectToHaveCount(enterCodeTestIds.email, 0);
    });

  chooseEmailInstead = () => this.step("chooseEmailInstead", () => this.click(enterCodeTestIds.emailInsteadButton));
}
