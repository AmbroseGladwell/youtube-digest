import { expect } from "@playwright/experimental-ct-react";
import { emailLinkFormTestIds } from "../../src/features/auth/components/EmailLinkForm/EmailLinkFormTestIds.js";
import { consentAddressCardTestIds } from "../../src/features/connections/components/ConsentAddressCard/ConsentAddressCardTestIds.js";
import { consentAnswerTestIds } from "../../src/features/connections/components/ConsentAnswer/ConsentAnswerTestIds.js";
import { consentNoteTestIds } from "../../src/features/connections/components/ConsentNote/ConsentNoteTestIds.js";
import { consentPlusCardTestIds } from "../../src/features/connections/components/ConsentPlusCard/ConsentPlusCardTestIds.js";
import { consentSignInCardTestIds } from "../../src/features/connections/components/ConsentSignInCard/ConsentSignInCardTestIds.js";
import { consentPageTestIds } from "../../src/features/connections/ConsentPage/ConsentPageTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

// The page an assistant sends a reader to, /connect/<id> (docs/features/mcp-connector.md).
export class ConsentPageObject extends PageObject {
  verifyIsShown = (): Promise<ConsentPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(consentPageTestIds.root);
      return this;
    });

  verifyHeadingReads = (text: string) =>
    this.step(`verifyHeadingReads ${text}`, () => expect(this.get(consentPageTestIds.heading)).toHaveText(text));

  verifyHeadingIsNamed = (name: string) =>
    this.step(`verifyHeadingIsNamed ${name}`, () =>
      expect(this.get(consentPageTestIds.heading)).toHaveAccessibleName(name),
    );

  verifySubReads = (pattern: RegExp) =>
    this.step(`verifySubReads ${pattern.source}`, () => expect(this.get(consentPageTestIds.sub)).toHaveText(pattern));

  verifyHeadingHasFocus = () =>
    this.step("verifyHeadingHasFocus", () => expect(this.get(consentPageTestIds.heading)).toBeFocused());

  verifySendsBackTo = (host: string) =>
    this.step(`verifySendsBackTo ${host}`, () => expect(this.get(consentAddressCardTestIds.host)).toHaveText(host));

  verifySignedInAs = (email: string) =>
    this.step(`verifySignedInAs ${email}`, () =>
      expect(this.get(consentPageTestIds.signedInAs)).toContainText(email),
    );

  verifyListsPermissions = (texts: string[]) =>
    this.step("verifyListsPermissions", () => expect(this.get(consentAnswerTestIds.permission)).toHaveText(texts));

  verifyOffersApprove = (offered: boolean) =>
    this.step(`verifyOffersApprove ${offered}`, () =>
      offered
        ? this.expectToBeVisible(consentAnswerTestIds.approveButton)
        : this.expectToHaveCount(consentAnswerTestIds.approveButton, 0),
    );

  approve = () => this.step("approve", () => this.click(consentAnswerTestIds.approveButton));

  decline = () => this.step("decline", () => this.click(consentAnswerTestIds.declineButton));

  verifyIsSendingBack = (label: string) =>
    this.step(`verifyIsSendingBack ${label}`, async () => {
      await expect(this.get(consentAnswerTestIds.status)).toHaveText(label);
      await expect(this.get(consentAnswerTestIds.approveButton)).toBeDisabled();
      await expect(this.get(consentAnswerTestIds.declineButton)).toBeDisabled();
    });

  verifyDecisionErrorShown = () =>
    this.step("verifyDecisionErrorShown", () => this.expectToBeVisible(consentPageTestIds.decisionError));

  verifySessionErrorShown = () =>
    this.step("verifySessionErrorShown", () => this.expectToBeVisible(consentPageTestIds.sessionError));

  retrySession = () =>
    this.step("retrySession", () => this.get(consentPageTestIds.sessionError).getByRole("button").click());

  verifyOffersPlus = (openFor: string) =>
    this.step(`verifyOffersPlus ${openFor}`, async () => {
      await this.expectToBeVisible(consentPlusCardTestIds.root);
      await expect(this.get(consentPlusCardTestIds.openFor)).toHaveText(openFor);
    });

  seePlus = () => this.step("seePlus", () => this.click(consentPlusCardTestIds.seePlusLink));

  declineOnFree = () => this.step("declineOnFree", () => this.click(consentPlusCardTestIds.declineButton));

  notYou = () => this.step("notYou", () => this.click(consentPageTestIds.notYouButton));

  verifyAsksToSignIn = () =>
    this.step("verifyAsksToSignIn", async () => {
      await this.expectToBeVisible(consentSignInCardTestIds.root);
      await this.expectToHaveCount(consentAnswerTestIds.root, 0);
    });

  requestLink = (email: string) =>
    this.step(`requestLink ${email}`, async () => {
      await this.get(emailLinkFormTestIds.emailInput).fill(email);
      await this.click(emailLinkFormTestIds.submitButton);
    });

  verifyChecksEmail = (email: string, openFor: string) =>
    this.step(`verifyChecksEmail ${email}`, async () => {
      await expect(this.get(consentPageTestIds.checkEmailAddress)).toHaveText(email);
      await expect(this.get(consentPageTestIds.waitingOpenFor)).toHaveText(openFor);
    });

  useDifferentEmail = () => this.step("useDifferentEmail", () => this.click(consentPageTestIds.differentEmailButton));

  verifyNoteReads = (title: string | null) =>
    this.step(`verifyNoteReads ${title}`, () =>
      title === null
        ? this.expectToHaveCount(consentNoteTestIds.root, 0)
        : expect(this.get(consentNoteTestIds.title)).toHaveText(title),
    );
}
