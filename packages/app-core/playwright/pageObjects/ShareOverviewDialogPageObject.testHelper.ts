import { expect } from "@playwright/experimental-ct-react";
import { shareOverviewDialogTestIds } from "../../src/features/shares/components/ShareOverviewDialog/ShareOverviewDialogTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class ShareOverviewDialogPageObject extends PageObject {
  verifyIsShown = (): Promise<ShareOverviewDialogPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(shareOverviewDialogTestIds.root);
      return this;
    });

  verifyIsNotShown = () =>
    this.step("verifyIsNotShown", () => this.expectNotToBeVisible(shareOverviewDialogTestIds.root));

  verifyHeadingReads = (text: string) =>
    this.step(`verifyHeadingReads ${text}`, () =>
      expect(this.get(shareOverviewDialogTestIds.heading)).toHaveText(text),
    );

  verifyListsWhatIsShared = (text: string) =>
    this.step(`verifyListsWhatIsShared ${text}`, () =>
      expect(this.get(shareOverviewDialogTestIds.shared)).toContainText(text),
    );

  verifyListsWhatStaysPrivate = (text: string) =>
    this.step(`verifyListsWhatStaysPrivate ${text}`, () =>
      expect(this.get(shareOverviewDialogTestIds.private)).toContainText(text),
    );

  verifyStatusReads = (text: string) =>
    this.step(`verifyStatusReads ${text}`, () =>
      expect(this.get(shareOverviewDialogTestIds.status)).toContainText(text),
    );

  verifyLinkReads = (url: string) =>
    this.step(`verifyLinkReads ${url}`, () => expect(this.get(shareOverviewDialogTestIds.link)).toHaveValue(url));

  verifySaysItWasEdited = () =>
    this.step("verifySaysItWasEdited", () =>
      this.expectToBeVisible(shareOverviewDialogTestIds.editedNotice),
    );

  verifyDoesNotSayItWasEdited = () =>
    this.step("verifyDoesNotSayItWasEdited", () =>
      this.expectNotToBeVisible(shareOverviewDialogTestIds.editedNotice),
    );

  verifyCopyButtonReads = (label: string) =>
    this.step(`verifyCopyButtonReads ${label}`, () =>
      expect(this.get(shareOverviewDialogTestIds.copyButton)).toHaveText(label),
    );

  verifyOffersSignIn = () =>
    this.step("verifyOffersSignIn", () => this.expectToBeVisible(shareOverviewDialogTestIds.signInButton));

  verifyFailureIsShown = () =>
    this.step("verifyFailureIsShown", () => this.expectToBeVisible(shareOverviewDialogTestIds.failure));

  clickCreateLink = () => this.step("clickCreateLink", () => this.click(shareOverviewDialogTestIds.createButton));

  clickCopyLink = () => this.step("clickCopyLink", () => this.click(shareOverviewDialogTestIds.copyButton));

  clickUpdateSharedCopy = () =>
    this.step("clickUpdateSharedCopy", () => this.click(shareOverviewDialogTestIds.updateButton));

  clickStopSharing = () => this.step("clickStopSharing", () => this.click(shareOverviewDialogTestIds.stopButton));

  clickConfirmStopSharing = () =>
    this.step("clickConfirmStopSharing", () => this.click(shareOverviewDialogTestIds.confirmStopButton));

  clickKeepSharing = () =>
    this.step("clickKeepSharing", () => this.click(shareOverviewDialogTestIds.keepSharingButton));

  clickDone = () => this.step("clickDone", () => this.click(shareOverviewDialogTestIds.doneButton));

  // What the reader actually ends up with in their clipboard, which is the point of the
  // whole feature and the one thing a click on Copy cannot prove on its own.
  readClipboard = (): Promise<string> =>
    this.step("readClipboard", () => this.page.evaluate(() => navigator.clipboard.readText()));
}
