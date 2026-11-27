import { expect } from "@playwright/experimental-ct-react";
import { manageTopicsDialogTestIds } from "../../src/features/topics/components/ManageTopicsDialog/ManageTopicsDialogTestIds.js";
import { bottomSheetTestIds } from "../../src/components/shared/BottomSheet/BottomSheetTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class ManageTopicsDialogPageObject extends PageObject {
  verifyIsShown = (): Promise<ManageTopicsDialogPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(manageTopicsDialogTestIds.root);
      return this;
    });

  verifyIsClosed = () => this.step("verifyIsClosed", () => this.expectNotToBeVisible(manageTopicsDialogTestIds.root));

  verifySummaryReads = (summary: string) =>
    this.step(`verifySummaryReads ${summary}`, () => expect(this.get(manageTopicsDialogTestIds.summary)).toHaveText(summary));

  verifyRowsRead = (rows: string[]) =>
    this.step(`verifyRowsRead ${rows.join(", ")}`, () =>
      expect(this.get(manageTopicsDialogTestIds.list).getByRole("listitem")).toHaveText(rows),
    );

  verifyBarHintReads = (hint: string) =>
    this.step(`verifyBarHintReads ${hint}`, () => expect(this.get(manageTopicsDialogTestIds.barHint)).toHaveText(hint));

  verifyBarOffers = (actions: { rename: boolean; merge: boolean }) =>
    this.step(`verifyBarOffers ${JSON.stringify(actions)}`, async () => {
      await this.expectToHaveCount(manageTopicsDialogTestIds.renameButton, actions.rename ? 1 : 0);
      await this.expectToHaveCount(manageTopicsDialogTestIds.mergeButton, actions.merge ? 1 : 0);
      await this.expectToBeVisible(manageTopicsDialogTestIds.deleteButton);
    });

  find = (text: string) => this.step(`find ${text}`, () => this.get(manageTopicsDialogTestIds.searchInput).fill(text));

  sortBy = (sort: "used" | "name") => this.step(`sortBy ${sort}`, () => this.click(manageTopicsDialogTestIds.sortOption(sort)));

  select = (...names: string[]) =>
    this.step(`select ${names.join(", ")}`, async () => {
      for (const name of names) {
        await this.click(manageTopicsDialogTestIds.row(name));
        await expect(this.get(manageTopicsDialogTestIds.row(name)).getByRole("checkbox")).toBeChecked();
      }
    });

  startRename = () => this.step("startRename", () => this.click(manageTopicsDialogTestIds.renameButton));

  verifyRenameFields = (name: string, description: string) =>
    this.step(`verifyRenameFields ${name} / ${description}`, async () => {
      await expect(this.get(manageTopicsDialogTestIds.nameInput)).toHaveValue(name);
      await expect(this.get(manageTopicsDialogTestIds.descriptionInput)).toHaveValue(description);
    });

  typeName = (name: string) => this.step(`typeName ${name}`, () => this.get(manageTopicsDialogTestIds.nameInput).fill(name));

  typeDescription = (description: string) =>
    this.step(`typeDescription ${description}`, () => this.get(manageTopicsDialogTestIds.descriptionInput).fill(description));

  clearDescription = () => this.step("clearDescription", () => this.click(manageTopicsDialogTestIds.clearDescriptionButton));

  verifyDescriptionLook = (look: string | null) =>
    this.step(`verifyDescriptionLook ${look}`, () =>
      look === null
        ? this.expectToHaveCount(manageTopicsDialogTestIds.descriptionLook, 0)
        : expect(this.get(manageTopicsDialogTestIds.descriptionLook)).toHaveText(look),
    );

  verifyRenameSays = (status: string | null, button: string) =>
    this.step(`verifyRenameSays ${status} ${button}`, async () => {
      if (status === null) {
        await this.expectToHaveCount(manageTopicsDialogTestIds.renameStatus, 0);
      } else {
        await expect(this.get(manageTopicsDialogTestIds.renameStatus)).toHaveText(status);
      }
      await expect(this.get(manageTopicsDialogTestIds.saveRenameButton)).toHaveText(button);
    });

  verifySaveIsRefused = () =>
    this.step("verifySaveIsRefused", () => expect(this.get(manageTopicsDialogTestIds.saveRenameButton)).toBeDisabled());

  saveRename = () => this.step("saveRename", () => this.click(manageTopicsDialogTestIds.saveRenameButton));

  openMerge = () => this.step("openMerge", () => this.click(manageTopicsDialogTestIds.mergeButton));

  verifyKeptName = (name: string) =>
    this.step(`verifyKeptName ${name}`, () =>
      expect(this.get(manageTopicsDialogTestIds.keepOption(name)).getByRole("radio")).toBeChecked(),
    );

  keepName = (name: string) => this.step(`keepName ${name}`, () => this.click(manageTopicsDialogTestIds.keepOption(name)));

  keepNewName = (name: string) =>
    this.step(`keepNewName ${name}`, async () => {
      await this.click(manageTopicsDialogTestIds.keepOption("new"));
      await this.get(manageTopicsDialogTestIds.newNameInput).fill(name);
    });

  verifyKeptDescription = (description: string) =>
    this.step(`verifyKeptDescription ${description}`, () =>
      expect(this.get(manageTopicsDialogTestIds.descriptionInput)).toHaveValue(description),
    );

  verifyBorrowNoteReads = (note: string) =>
    this.step(`verifyBorrowNoteReads ${note}`, () => expect(this.get(manageTopicsDialogTestIds.borrowNote)).toHaveText(note));

  verifyMergeSays = (summary: string, button: string) =>
    this.step(`verifyMergeSays ${summary}`, async () => {
      await expect(this.get(manageTopicsDialogTestIds.mergeSummary)).toHaveText(summary);
      await expect(this.get(manageTopicsDialogTestIds.confirmMergeButton)).toHaveText(button);
    });

  confirmMerge = () => this.step("confirmMerge", () => this.click(manageTopicsDialogTestIds.confirmMergeButton));

  delete = () => this.step("delete", () => this.click(manageTopicsDialogTestIds.deleteButton));

  verifyDeleteAsks = (text: string) =>
    this.step(`verifyDeleteAsks ${text}`, async () => {
      await this.expectToBeVisible(manageTopicsDialogTestIds.deleteStep);
      await expect(this.get(manageTopicsDialogTestIds.root)).toContainText(text);
      await expect(this.get(manageTopicsDialogTestIds.keepButton)).toBeFocused();
    });

  confirmDelete = () => this.step("confirmDelete", () => this.click(manageTopicsDialogTestIds.confirmDeleteButton));

  keep = () => this.step("keep", () => this.click(manageTopicsDialogTestIds.keepButton));

  verifyNoticeReads = (notice: string, undo: boolean) =>
    this.step(`verifyNoticeReads ${notice}`, async () => {
      await expect(this.get(manageTopicsDialogTestIds.notice)).toContainText(notice);
      await this.expectToHaveCount(manageTopicsDialogTestIds.undoButton, undo ? 1 : 0);
    });

  undo = () => this.step("undo", () => this.click(manageTopicsDialogTestIds.undoButton));

  verifyDialogCanBeUsed = () =>
    this.step("verifyDialogCanBeUsed", () => this.verifyControlsCanBeReached(this.get(manageTopicsDialogTestIds.root)));

  close = () => this.step("close", () => this.click(this.get(manageTopicsDialogTestIds.root).getByTestId(bottomSheetTestIds.close)));

  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));
}
