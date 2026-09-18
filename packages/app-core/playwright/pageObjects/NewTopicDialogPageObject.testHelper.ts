import { expect } from "@playwright/experimental-ct-react";
import { newTopicDialogTestIds } from "../../src/features/library/components/NewTopicDialog/NewTopicDialogTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class NewTopicDialogPageObject extends PageObject {
  verifyIsShown = (): Promise<NewTopicDialogPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(newTopicDialogTestIds.root);
      return this;
    });

  verifyIsNotShown = () =>
    this.step("verifyIsNotShown", () => this.expectNotToBeVisible(newTopicDialogTestIds.root));

  typeName = (name: string) =>
    this.step(`typeName ${name}`, () => this.get(newTopicDialogTestIds.nameInput).fill(name));

  verifyHintReads = (hint: string) =>
    this.step(`verifyHintReads ${hint}`, () => expect(this.get(newTopicDialogTestIds.hint)).toHaveText(hint));

  verifyUnsortedHeadReads = (head: string) =>
    this.step(`verifyUnsortedHeadReads ${head}`, () =>
      expect(this.get(newTopicDialogTestIds.unsortedHead)).toHaveText(head),
    );

  verifyOffersNoUnsorted = () =>
    this.step("verifyOffersNoUnsorted", () => this.expectNotToBeVisible(newTopicDialogTestIds.unsortedHead));

  // The checkbox itself is visually hidden behind its drawn box, so the label is what a
  // person clicks and what the test clicks too.
  chooseUnsorted = (title: string) =>
    this.step(`chooseUnsorted ${title}`, () => this.click(newTopicDialogTestIds.unsortedOption(title)));

  verifyUnsortedIsChosen = (title: string, chosen: boolean) =>
    this.step(`verifyUnsortedIsChosen ${title} ${chosen}`, () =>
      expect(this.get(newTopicDialogTestIds.unsortedOption(title)).getByRole("checkbox")).toBeChecked({
        checked: chosen,
      }),
    );

  verifyCreateReads = (label: string) =>
    this.step(`verifyCreateReads ${label}`, () =>
      expect(this.get(newTopicDialogTestIds.createButton)).toHaveText(label),
    );

  verifyCreateIsDisabled = (disabled: boolean) =>
    this.step(`verifyCreateIsDisabled ${disabled}`, () =>
      disabled
        ? expect(this.get(newTopicDialogTestIds.createButton)).toBeDisabled()
        : expect(this.get(newTopicDialogTestIds.createButton)).toBeEnabled(),
    );

  clickCreate = () => this.step("clickCreate", () => this.click(newTopicDialogTestIds.createButton));
  clickCancel = () => this.step("clickCancel", () => this.click(newTopicDialogTestIds.cancelButton));
  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));
}
