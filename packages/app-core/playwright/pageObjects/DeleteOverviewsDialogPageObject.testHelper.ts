import { expect } from "@playwright/experimental-ct-react";
import { deleteOverviewsDialogTestIds } from "../../src/features/library/components/DeleteOverviewsDialog/DeleteOverviewsDialogTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class DeleteOverviewsDialogPageObject extends PageObject {
  verifyIsShown = (): Promise<DeleteOverviewsDialogPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(deleteOverviewsDialogTestIds.root);
      return this;
    });

  verifyReads = (heading: string, body: string) =>
    this.step(`verifyReads ${heading}`, async () => {
      await expect(this.get(deleteOverviewsDialogTestIds.root).getByRole("heading")).toHaveText(heading);
      await expect(this.get(deleteOverviewsDialogTestIds.body)).toHaveText(body);
    });

  verifyCancelIsFocused = () =>
    this.step("verifyCancelIsFocused", () => expect(this.get(deleteOverviewsDialogTestIds.cancelButton)).toBeFocused());

  verifyDeleteReads = (label: string) =>
    this.step(`verifyDeleteReads ${label}`, () => expect(this.get(deleteOverviewsDialogTestIds.deleteButton)).toHaveText(label));

  cancel = () => this.step("cancel", () => this.click(deleteOverviewsDialogTestIds.cancelButton));

  confirm = () => this.step("confirm", () => this.click(deleteOverviewsDialogTestIds.deleteButton));
}
