import { expect } from "@playwright/experimental-ct-react";
import { syncPanelTestIds } from "../../src/features/sync/components/SyncPanel/SyncPanelTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class SyncPanelPageObject extends PageObject {
  // In the viewport, not merely on the page: the bar's Sign in lands here by hash, and
  // the assertion is that the scroll actually happened.
  verifyIsInView = () =>
    this.step("verifyIsInView", () => expect(this.get(syncPanelTestIds.root)).toBeInViewport());

  verifyIsShown = (): Promise<SyncPanelPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(syncPanelTestIds.root);
      return this;
    });

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectToHaveCount(syncPanelTestIds.root, 0));

  verifyAsksToSignIn = () =>
    this.step("verifyAsksToSignIn", () => this.expectToBeVisible(syncPanelTestIds.requestLinkButton));

  verifyServerAddressReads = (apiUrl: string) =>
    this.step(`verifyServerAddressReads ${apiUrl}`, () =>
      expect(this.get(syncPanelTestIds.apiUrlInput)).toHaveValue(apiUrl),
    );

  setServerAddress = (apiUrl: string) =>
    this.step(`setServerAddress ${apiUrl}`, () => this.get(syncPanelTestIds.apiUrlInput).fill(apiUrl));

  requestLink = (email: string) =>
    this.step(`requestLink ${email}`, async () => {
      await this.get(syncPanelTestIds.emailInput).fill(email);
      await this.click(syncPanelTestIds.requestLinkButton);
    });

  verifyLinkSentReads = (pattern: RegExp) =>
    this.step(`verifyLinkSentReads ${pattern.source}`, () =>
      expect(this.get(syncPanelTestIds.linkSent)).toHaveText(pattern),
    );

  enterCode = (code: string) =>
    this.step(`enterCode ${code}`, async () => {
      await this.get(syncPanelTestIds.codeInput).fill(code);
      await this.click(syncPanelTestIds.connectButton);
    });

  verifyFormErrorReads = (pattern: RegExp) =>
    this.step(`verifyFormErrorReads ${pattern.source}`, () =>
      expect(this.get(syncPanelTestIds.formError)).toHaveText(pattern),
    );

  verifySignedInAs = (email: string) =>
    this.step(`verifySignedInAs ${email}`, () =>
      expect(this.get(syncPanelTestIds.signedInAs)).toHaveText(`Signed in as ${email}`),
    );

  verifyStatusReads = (pattern: RegExp) =>
    this.step(`verifyStatusReads ${pattern.source}`, () =>
      expect(this.get(syncPanelTestIds.statusLine)).toHaveText(pattern),
    );

  clickSyncNow = () => this.step("clickSyncNow", () => this.click(syncPanelTestIds.syncNowButton));

  clickSignOut = () => this.step("clickSignOut", () => this.click(syncPanelTestIds.signOutButton));
}
