import { expect } from "@playwright/experimental-ct-react";
import { sharedLinksPanelTestIds } from "../../src/features/shares/components/SharedLinksPanel/SharedLinksPanelTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class SharedLinksPanelPageObject extends PageObject {
  verifyIsShown = (): Promise<SharedLinksPanelPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(sharedLinksPanelTestIds.root);
      return this;
    });

  verifySaysNothingIsShared = () =>
    this.step("verifySaysNothingIsShared", () => this.expectToBeVisible(sharedLinksPanelTestIds.empty));

  expectRowCountToBe = (count: number) =>
    this.step(`expectRowCountToBe ${count}`, () => this.expectToHaveCount(sharedLinksPanelTestIds.row, count));

  verifyRowTitles = (titles: string[]) =>
    this.step(`verifyRowTitles ${titles.join(", ")}`, () =>
      expect(this.get(sharedLinksPanelTestIds.rowTitle)).toHaveText(titles),
    );

  verifyRowSaysItWasEdited = () =>
    this.step("verifyRowSaysItWasEdited", () => this.expectToBeVisible(sharedLinksPanelTestIds.editedBadge));

  clickStopSharing = () => this.step("clickStopSharing", () => this.click(sharedLinksPanelTestIds.stopButton));

  clickKeepSharing = () =>
    this.step("clickKeepSharing", () => this.click(sharedLinksPanelTestIds.keepSharingButton));

  clickConfirmStopSharing = () =>
    this.step("clickConfirmStopSharing", () => this.click(sharedLinksPanelTestIds.confirmStopButton));

  verifyAsksBeforeStopping = () =>
    this.step("verifyAsksBeforeStopping", () => this.expectToBeVisible(sharedLinksPanelTestIds.confirm));
}
