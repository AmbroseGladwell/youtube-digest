import { expect } from "@playwright/experimental-ct-react";
import { deleteOverviewDialogTestIds } from "../../src/features/reader/components/DeleteOverviewDialog/DeleteOverviewDialogTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { HomePageObject } from "./HomePageObject.testHelper.js";

export class DeleteOverviewDialogPageObject extends PageObject {
  verifyIsShown = (): Promise<DeleteOverviewDialogPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(deleteOverviewDialogTestIds.root);
      return this;
    });

  verifyIsNotShown = () =>
    this.step("verifyIsNotShown", () => this.expectNotToBeVisible(deleteOverviewDialogTestIds.root));

  verifyBodyMentions = (text: string) =>
    this.step(`verifyBodyMentions ${text}`, () =>
      expect(this.get(deleteOverviewDialogTestIds.body)).toContainText(text),
    );

  verifyFocusIsOnCancel = () =>
    this.step("verifyFocusIsOnCancel", () =>
      expect(this.get(deleteOverviewDialogTestIds.cancelButton)).toBeFocused(),
    );

  clickCancel = () => this.step("clickCancel", () => this.click(deleteOverviewDialogTestIds.cancelButton));

  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));

  clickDelete = (): Promise<HomePageObject> =>
    this.step("clickDelete", async () => {
      await this.click(deleteOverviewDialogTestIds.deleteButton);
      return new HomePageObject(this.testContext).verifyIsShown();
    });
}
