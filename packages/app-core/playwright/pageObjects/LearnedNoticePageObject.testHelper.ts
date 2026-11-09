import { expect } from "@playwright/experimental-ct-react";
import { learnedNoticeTestIds } from "../../src/features/settings/components/LearnedNotice/LearnedNoticeTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class LearnedNoticePageObject extends PageObject {
  verifyOffers = (...items: string[]) =>
    this.step(`verifyOffers ${items.join(", ")}`, async () => {
      for (const item of items) await this.expectToBeVisible(learnedNoticeTestIds.item(item));
    });

  verifyReads = (text: string) => this.step(`verifyReads ${text}`, () => expect(this.get(learnedNoticeTestIds.root)).toContainText(text));

  verifyIsGone = () => this.step("verifyIsGone", () => this.expectNotToBeVisible(learnedNoticeTestIds.root));

  undo = (item: string) => this.step(`undo ${item}`, () => this.click(learnedNoticeTestIds.undo(item)));

  see = () => this.step("see", () => this.click(learnedNoticeTestIds.see));

  dismiss = () => this.step("dismiss", () => this.click(learnedNoticeTestIds.dismiss));
}
