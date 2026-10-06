import { expect } from "@playwright/experimental-ct-react";
import { manageTagsDialogTestIds } from "../../src/features/tags/components/ManageTagsDialog/ManageTagsDialogTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class ManageTagsDialogPageObject extends PageObject {
  verifyIsShown = (): Promise<ManageTagsDialogPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(manageTagsDialogTestIds.root);
      return this;
    });

  verifyIsClosed = () => this.step("verifyIsClosed", () => this.expectNotToBeVisible(manageTagsDialogTestIds.root));

  verifySummaryReads = (summary: string) =>
    this.step(`verifySummaryReads ${summary}`, () => expect(this.get(manageTagsDialogTestIds.summary)).toHaveText(summary));

  verifyRowsRead = (rows: string[]) =>
    this.step(`verifyRowsRead ${rows.join(", ")}`, () =>
      expect(this.get(manageTagsDialogTestIds.list).getByRole("listitem")).toHaveText(rows),
    );

  find = (text: string) => this.step(`find ${text}`, () => this.get(manageTagsDialogTestIds.searchInput).fill(text));

  sortBy = (sort: "used" | "name") => this.step(`sortBy ${sort}`, () => this.click(manageTagsDialogTestIds.sortOption(sort)));

  select = (...tags: string[]) =>
    this.step(`select ${tags.join(", ")}`, async () => {
      for (const tag of tags) {
        await this.click(manageTagsDialogTestIds.row(tag));
        await expect(this.get(manageTagsDialogTestIds.row(tag)).getByRole("checkbox")).toBeChecked();
      }
    });

  startRename = () => this.step("startRename", () => this.click(manageTagsDialogTestIds.renameButton));

  typeNewName = (name: string) =>
    this.step(`typeNewName ${name}`, () => this.get(manageTagsDialogTestIds.renameInput).fill(name));

  verifyRenameSays = (status: string, button: string) =>
    this.step(`verifyRenameSays ${status} ${button}`, async () => {
      await expect(this.get(manageTagsDialogTestIds.renameStatus)).toHaveText(status);
      await expect(this.get(manageTagsDialogTestIds.saveRenameButton)).toHaveText(button);
    });

  verifyRenameIsRefused = () =>
    this.step("verifyRenameIsRefused", () => expect(this.get(manageTagsDialogTestIds.saveRenameButton)).toBeDisabled());

  saveRename = () => this.step("saveRename", () => this.click(manageTagsDialogTestIds.saveRenameButton));

  openMerge = () => this.step("openMerge", () => this.click(manageTagsDialogTestIds.mergeButton));

  keepName = (tag: string) =>
    this.step(`keepName ${tag}`, () => this.click(manageTagsDialogTestIds.keepOption(tag)));

  keepNewName = (name: string) =>
    this.step(`keepNewName ${name}`, async () => {
      await this.click(manageTagsDialogTestIds.keepOption("new"));
      await this.get(manageTagsDialogTestIds.newNameInput).fill(name);
    });

  verifyMergeSays = (summary: string, button: string) =>
    this.step(`verifyMergeSays ${summary}`, async () => {
      await expect(this.get(manageTagsDialogTestIds.mergeSummary)).toHaveText(summary);
      await expect(this.get(manageTagsDialogTestIds.confirmMergeButton)).toHaveText(button);
    });

  confirmMerge = () => this.step("confirmMerge", () => this.click(manageTagsDialogTestIds.confirmMergeButton));

  delete = () => this.step("delete", () => this.click(manageTagsDialogTestIds.deleteButton));

  verifyNoticeReads = (notice: string) =>
    this.step(`verifyNoticeReads ${notice}`, () => expect(this.get(manageTagsDialogTestIds.notice)).toContainText(notice));

  undo = () => this.step("undo", () => this.click(manageTagsDialogTestIds.undoButton));

  close = () => this.step("close", () => this.click(manageTagsDialogTestIds.closeButton));

  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));
}
