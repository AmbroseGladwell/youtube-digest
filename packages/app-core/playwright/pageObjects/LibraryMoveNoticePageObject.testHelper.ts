import { expect } from "@playwright/experimental-ct-react";
import { libraryMoveNoticeTestIds } from "../../src/features/accountLibraries/components/LibraryMoveNotice/LibraryMoveNoticeTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class LibraryMoveNoticePageObject extends PageObject {
  verifyReads = (lead: string, then: string | null) =>
    this.step(`verifyReads ${lead}`, async () => {
      await expect(this.get(libraryMoveNoticeTestIds.root)).toHaveAttribute("role", "status");
      await expect(this.get(libraryMoveNoticeTestIds.lead)).toHaveText(lead);
      if (then === null) await this.expectNotToBeVisible(libraryMoveNoticeTestIds.then);
      else await expect(this.get(libraryMoveNoticeTestIds.then)).toHaveText(then);
    });

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectNotToBeVisible(libraryMoveNoticeTestIds.root));

  dismiss = () => this.step("dismiss", () => this.click(libraryMoveNoticeTestIds.dismiss));
}
