import { expect } from "@playwright/experimental-ct-react";
import { projectActionsMenuTestIds } from "../../src/features/projects/components/ProjectActionsMenu/ProjectActionsMenuTestIds.js";
import { projectEmptyTestIds } from "../../src/features/projects/components/ProjectEmpty/ProjectEmptyTestIds.js";
import { projectHeadTestIds } from "../../src/features/projects/components/ProjectHead/ProjectHeadTestIds.js";
import { DeleteProjectDialogPageObject } from "./DeleteProjectDialogPageObject.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";

export class ProjectHeadPageObject extends PageObject {
  verifyIsShown = (): Promise<ProjectHeadPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(projectHeadTestIds.root);
      return this;
    });

  verifyNameReads = (name: string) =>
    this.step(`verifyNameReads ${name}`, () => expect(this.get(projectHeadTestIds.name)).toHaveText(name));
  verifyKickerReads = (text: string) =>
    this.step(`verifyKickerReads ${text}`, () => expect(this.get(projectHeadTestIds.kicker)).toHaveText(text));
  verifyPurposeReads = (text: string) =>
    this.step("verifyPurposeReads", () => expect(this.get(projectHeadTestIds.purposeText)).toHaveText(text));
  verifyFactsRead = (text: string) =>
    this.step(`verifyFactsRead ${text}`, () => expect(this.get(projectHeadTestIds.facts)).toHaveText(text));
  verifySpreadReads = (text: string) =>
    this.step(`verifySpreadReads ${text}`, () => expect(this.get(projectHeadTestIds.spread)).toHaveText(text));

  verifyAssistantHintIsShown = (shown: boolean) =>
    this.step(`verifyAssistantHintIsShown ${shown}`, () =>
      shown ? this.expectToBeVisible(projectHeadTestIds.purposeHint) : this.expectNotToBeVisible(projectHeadTestIds.purposeHint),
    );

  verifyWrittenByReads = (text: string | null) =>
    this.step(`verifyWrittenByReads ${text}`, () =>
      text === null
        ? this.expectNotToBeVisible(projectHeadTestIds.writtenBy)
        : expect(this.get(projectHeadTestIds.writtenBy)).toHaveText(text),
    );

  verifyInvitesAPurpose = (text: RegExp) =>
    this.step("verifyInvitesAPurpose", () => expect(this.get(projectHeadTestIds.purposeInvitation)).toHaveText(text));

  verifyArchivedStripReads = (text: string | null) =>
    this.step(`verifyArchivedStripReads ${text}`, () =>
      text === null
        ? this.expectNotToBeVisible(projectHeadTestIds.archivedStrip)
        : expect(this.get(projectHeadTestIds.archivedStrip)).toHaveText(text),
    );

  verifyNudgeReads = (text: string | null) =>
    this.step(`verifyNudgeReads ${text}`, () =>
      text === null ? this.expectNotToBeVisible(projectHeadTestIds.nudge) : expect(this.get(projectHeadTestIds.nudge)).toContainText(text),
    );

  clickKeep = () => this.step("clickKeep", () => this.click(projectHeadTestIds.keepButton));
  clickRestore = () => this.step("clickRestore", () => this.click(projectHeadTestIds.restoreButton));
  clickCopy = () => this.step("clickCopy", () => this.click(projectHeadTestIds.copyButton));
  verifyCopyReads = (text: string) =>
    this.step(`verifyCopyReads ${text}`, () => expect(this.get(projectHeadTestIds.copyButton)).toHaveText(text));

  private menu = async (item: string) => {
    await this.click(projectActionsMenuTestIds.trigger);
    await this.click(item);
  };

  rename = (name: string, finish: "Enter" | "Escape" = "Enter") =>
    this.step(`rename ${name} ${finish}`, async () => {
      await this.menu(projectActionsMenuTestIds.renameItem);
      await expect(this.get(projectHeadTestIds.nameInput)).toBeFocused();
      await this.get(projectHeadTestIds.nameInput).fill(name);
      await this.page.keyboard.press(finish);
    });

  verifyMenuIsFocused = () => this.step("verifyMenuIsFocused", () => expect(this.get(projectActionsMenuTestIds.trigger)).toBeFocused());

  editPurpose = (purpose: string) =>
    this.step("editPurpose", async () => {
      await this.click(projectHeadTestIds.editPurposeButton);
      await this.get(projectHeadTestIds.purposeInput).fill(purpose);
    });

  addPurpose = (purpose: string) =>
    this.step("addPurpose", async () => {
      await this.click(projectHeadTestIds.addPurposeButton);
      await this.get(projectHeadTestIds.purposeInput).fill(purpose);
    });

  verifyPurposeHelpReads = (text: string) =>
    this.step(`verifyPurposeHelpReads ${text}`, () => expect(this.get(projectHeadTestIds.purposeHelp)).toHaveText(text));

  clickSave = () => this.step("clickSave", () => this.click(projectHeadTestIds.saveButton));

  archive = () => this.step("archive", () => this.menu(projectActionsMenuTestIds.archiveItem));

  delete = (): Promise<DeleteProjectDialogPageObject> =>
    this.step("delete", async () => {
      await this.menu(projectActionsMenuTestIds.deleteItem);
      return new DeleteProjectDialogPageObject(this.testContext).verifyIsShown();
    });

  verifyEmptyIsShown = () => this.step("verifyEmptyIsShown", () => this.expectToBeVisible(projectEmptyTestIds.root));

  verifyEmptyOffersPrompt = (prompt: string | null) =>
    this.step(`verifyEmptyOffersPrompt ${prompt}`, () =>
      prompt === null
        ? this.expectToBeVisible(projectEmptyTestIds.connectionsLink)
        : expect(this.get(projectEmptyTestIds.prompt)).toHaveText(prompt),
    );
}
