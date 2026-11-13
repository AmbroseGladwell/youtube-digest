import { expect } from "@playwright/experimental-ct-react";
import { newProjectDialogTestIds } from "../../src/features/projects/components/NewProjectDialog/NewProjectDialogTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class NewProjectDialogPageObject extends PageObject {
  verifyIsShown = (): Promise<NewProjectDialogPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(newProjectDialogTestIds.root);
      return this;
    });

  verifyIsNotShown = () => this.step("verifyIsNotShown", () => this.expectNotToBeVisible(newProjectDialogTestIds.root));

  verifySpansTheScreen = (width: number) =>
    this.step(`verifySpansTheScreen ${width}`, async () => {
      const box = await this.get(newProjectDialogTestIds.root).locator("form").boundingBox();
      expect(box).toMatchObject({ x: 0, width });
    });

  typeName = (name: string) => this.step(`typeName ${name}`, () => this.get(newProjectDialogTestIds.nameInput).fill(name));
  typePurpose = (purpose: string) => this.step("typePurpose", () => this.get(newProjectDialogTestIds.purposeInput).fill(purpose));

  verifyAddsReads = (text: string) =>
    this.step(`verifyAddsReads ${text}`, () => expect(this.get(newProjectDialogTestIds.adds)).toHaveText(text));

  verifyHelpReads = (text: string) =>
    this.step(`verifyHelpReads ${text}`, () => expect(this.get(newProjectDialogTestIds.purposeHelp)).toHaveText(text));

  verifyCountsRead = (name: string, purpose: string) =>
    this.step(`verifyCountsRead ${name} ${purpose}`, async () => {
      await expect(this.get(newProjectDialogTestIds.nameCount)).toHaveText(name);
      await expect(this.get(newProjectDialogTestIds.purposeCount)).toHaveText(purpose);
    });

  verifyTakenReads = (text: string) =>
    this.step(`verifyTakenReads ${text}`, () => expect(this.get(newProjectDialogTestIds.taken)).toHaveText(text));

  verifyCreateIsDisabled = (disabled: boolean) =>
    this.step(`verifyCreateIsDisabled ${disabled}`, () =>
      disabled
        ? expect(this.get(newProjectDialogTestIds.createButton)).toBeDisabled()
        : expect(this.get(newProjectDialogTestIds.createButton)).toBeEnabled(),
    );

  clickCreate = () => this.step("clickCreate", () => this.click(newProjectDialogTestIds.createButton));
  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));
}
