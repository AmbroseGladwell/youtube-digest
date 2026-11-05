import { expect } from "@playwright/experimental-ct-react";
import { syncPanelTestIds } from "../../src/features/sync/components/SyncPanel/SyncPanelTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { SignInPageObject } from "./SignInPageObject.testHelper.js";

export class SyncPanelPageObject extends PageObject {
  verifyIsShown = (): Promise<SyncPanelPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(syncPanelTestIds.root);
      return this;
    });

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectToHaveCount(syncPanelTestIds.root, 0));

  verifyHintReads = (pattern: RegExp) =>
    this.step(`verifyHintReads ${String(pattern)}`, () => expect(this.get(syncPanelTestIds.hint)).toHaveText(pattern));

  verifyAsksToSignIn = () =>
    this.step("verifyAsksToSignIn", async () => {
      await this.expectToBeVisible(syncPanelTestIds.signInLink);
      await this.expectToBeVisible(syncPanelTestIds.createAccountLink);
    });

  clickSignIn = (): Promise<SignInPageObject> =>
    this.step("clickSignIn", async () => {
      await this.click(syncPanelTestIds.signInLink);
      return new SignInPageObject(this.testContext).verifyAsksForEmail("Sign in");
    });

  clickCreateAccount = () => this.step("clickCreateAccount", () => this.click(syncPanelTestIds.createAccountLink));

  verifyOffersConnectingExtension = (offers: boolean) =>
    this.step(`verifyOffersConnectingExtension ${offers}`, () =>
      offers
        ? this.expectToBeVisible(syncPanelTestIds.connectExtensionLink)
        : this.expectToHaveCount(syncPanelTestIds.connectExtensionLink, 0),
    );

  clickConnectExtension = (): Promise<SignInPageObject> =>
    this.step("clickConnectExtension", async () => {
      await this.click(syncPanelTestIds.connectExtensionLink);
      return new SignInPageObject(this.testContext);
    });

  verifyStatusReads = (pattern: RegExp) =>
    this.step(`verifyStatusReads ${pattern.source}`, () =>
      expect(this.get(syncPanelTestIds.statusLine)).toHaveText(pattern),
    );

  clickSyncNow = () => this.step("clickSyncNow", () => this.click(syncPanelTestIds.syncNowButton));

  verifySyncNowIsPrimary = (primary: boolean) =>
    this.step(`verifySyncNowIsPrimary ${primary}`, () =>
      expect(this.get(syncPanelTestIds.syncNowButton)).toHaveClass(primary ? /primaryButton/ : /secondaryButton/),
    );

  clickSignOut = () => this.step("clickSignOut", () => this.click(syncPanelTestIds.signOutButton));
}
