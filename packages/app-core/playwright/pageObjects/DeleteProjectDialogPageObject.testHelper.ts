import { expect } from "@playwright/experimental-ct-react";
import { deleteProjectDialogTestIds } from "../../src/features/projects/components/DeleteProjectDialog/DeleteProjectDialogTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class DeleteProjectDialogPageObject extends PageObject {
  verifyIsShown = (): Promise<DeleteProjectDialogPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(deleteProjectDialogTestIds.root);
      return this;
    });

  verifyBodyReads = (text: string) =>
    this.step(`verifyBodyReads ${text}`, () => expect(this.get(deleteProjectDialogTestIds.body)).toHaveText(text));

  verifyCancelIsFocused = () =>
    this.step("verifyCancelIsFocused", () => expect(this.get(deleteProjectDialogTestIds.cancelButton)).toBeFocused());

  clickDelete = () => this.step("clickDelete", () => this.click(deleteProjectDialogTestIds.deleteButton));
}
