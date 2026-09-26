import { expect } from "@playwright/experimental-ct-react";
import { syncPanelTestIds } from "../../src/features/sync/components/SyncPanel/SyncPanelTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class SyncPanelPageObject extends PageObject {
  verifyIsShown = (): Promise<SyncPanelPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(syncPanelTestIds.root);
      return this;
    });

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectToHaveCount(syncPanelTestIds.root, 0));

  verifyAsksToConnect = () =>
    this.step("verifyAsksToConnect", () => this.expectToBeVisible(syncPanelTestIds.connectButton));

  connect = (apiUrl: string, token: string) =>
    this.step(`connect ${apiUrl}`, async () => {
      await this.get(syncPanelTestIds.apiUrlInput).fill(apiUrl);
      await this.get(syncPanelTestIds.tokenInput).fill(token);
      await this.click(syncPanelTestIds.connectButton);
    });

  verifyStatusReads = (pattern: RegExp) =>
    this.step(`verifyStatusReads ${pattern.source}`, () =>
      expect(this.get(syncPanelTestIds.statusLine)).toHaveText(pattern),
    );

  clickSyncNow = () => this.step("clickSyncNow", () => this.click(syncPanelTestIds.syncNowButton));

  clickDisconnect = () => this.step("clickDisconnect", () => this.click(syncPanelTestIds.disconnectButton));
}
