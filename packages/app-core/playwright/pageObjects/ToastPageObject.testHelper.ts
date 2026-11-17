import { expect } from "@playwright/experimental-ct-react";
import { toastTestIds } from "../../src/components/shared/Toast/ToastTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class ToastPageObject extends PageObject {
  verifyReads = (text: string) => this.step(`verifyReads ${text}`, () => expect(this.page.getByTestId(toastTestIds.root)).toHaveText(text));

  clickUndo = () => this.step("clickUndo", () => this.page.getByTestId(toastTestIds.undoButton).click());

  verifyIsNotShown = () => this.step("verifyIsNotShown", () => expect(this.page.getByTestId(toastTestIds.root)).toHaveCount(0));
}
