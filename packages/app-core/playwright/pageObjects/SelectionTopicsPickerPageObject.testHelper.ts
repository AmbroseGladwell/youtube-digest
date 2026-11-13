import { expect } from "@playwright/experimental-ct-react";
import { selectionTopicsPickerTestIds } from "../../src/features/library/components/SelectionTopicsPicker/SelectionTopicsPickerTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class SelectionTopicsPickerPageObject extends PageObject {
  verifyIsShown = (): Promise<SelectionTopicsPickerPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(selectionTopicsPickerTestIds.root);
      return this;
    });

  verifyHeadingReads = (text: string) =>
    this.step(`verifyHeadingReads ${text}`, () =>
      expect(this.get(selectionTopicsPickerTestIds.root).getByRole("heading")).toHaveText(text),
    );

  verifyOptionState = (name: string, state: "all" | "some" | "none") =>
    this.step(`verifyOptionState ${name} ${state}`, () =>
      expect(this.get(selectionTopicsPickerTestIds.option(name))).toHaveAttribute("data-state", state),
    );

  verifyOptionReads = (name: string, text: string) =>
    this.step(`verifyOptionReads ${name}`, () => expect(this.get(selectionTopicsPickerTestIds.option(name))).toHaveText(text));

  tick = (name: string) => this.step(`tick ${name}`, () => this.click(selectionTopicsPickerTestIds.option(name)));

  verifyFootReads = (text: string) =>
    this.step(`verifyFootReads ${text}`, () => expect(this.get(selectionTopicsPickerTestIds.foot)).toHaveText(text));

  makeTopic = (name: string) =>
    this.step(`makeTopic ${name}`, async () => {
      await this.click(selectionTopicsPickerTestIds.newProjectButton);
      const field = this.get(selectionTopicsPickerTestIds.root).getByRole("textbox", { name: "Name the topic" });
      await field.fill(name);
      await field.press("Enter");
    });

  clickDone = () => this.step("clickDone", () => this.click(selectionTopicsPickerTestIds.doneButton));
}
