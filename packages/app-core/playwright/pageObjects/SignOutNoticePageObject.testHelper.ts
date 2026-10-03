import { expect } from "@playwright/experimental-ct-react";
import { signOutNoticeTestIds } from "../../src/features/accountLibraries/components/SignOutNotice/SignOutNoticeTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class SignOutNoticePageObject extends PageObject {
  verifyLeadReads = (lead: string) =>
    this.step(`verifyLeadReads ${lead}`, async () => {
      await expect(this.get(signOutNoticeTestIds.root)).toHaveAttribute("role", "status");
      await expect(this.get(signOutNoticeTestIds.lead)).toHaveText(lead);
    });

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectNotToBeVisible(signOutNoticeTestIds.root));

  dismiss = () => this.step("dismiss", () => this.click(signOutNoticeTestIds.dismiss));
}
