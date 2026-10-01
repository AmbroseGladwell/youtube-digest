import { expect } from "@playwright/experimental-ct-react";
import { timeSavedSheetTestIds } from "../../src/features/timeSaved/components/TimeSavedSheet/TimeSavedSheetTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class TimeSavedSheetPageObject extends PageObject {
  verifyIsShown = (): Promise<TimeSavedSheetPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(timeSavedSheetTestIds.root);
      return this;
    });

  verifyIsClosed = () => this.step("verifyIsClosed", () => this.expectNotToBeVisible(timeSavedSheetTestIds.root));

  verifyFigureSays = (spoken: string) =>
    this.step(`verifyFigureSays ${spoken}`, () =>
      expect(this.get(timeSavedSheetTestIds.figure)).toHaveAttribute("aria-label", spoken),
    );

  verifyHowReads = (text: string) =>
    this.step(`verifyHowReads ${text}`, () => expect(this.get(timeSavedSheetTestIds.how)).toHaveText(text));

  verifyNextReads = (text: string) =>
    this.step(`verifyNextReads ${text}`, () => expect(this.get(timeSavedSheetTestIds.next)).toContainText(text));

  verifyReached = (labels: string[]) =>
    this.step(`verifyReached ${labels.join(", ")}`, () =>
      expect(this.get(timeSavedSheetTestIds.reached).getByRole("listitem")).toHaveText(labels),
    );

  verifyNotCounted = (lines: string[]) =>
    this.step(`verifyNotCounted ${lines.join(" / ")}`, async () => {
      for (const line of lines) {
        await expect(this.get(timeSavedSheetTestIds.notCounted)).toContainText(line);
      }
    });

  verifyNothingLeftOut = () =>
    this.step("verifyNothingLeftOut", () => this.expectNotToBeVisible(timeSavedSheetTestIds.notCounted));

  close = () =>
    this.step("close", async () => {
      await this.click(timeSavedSheetTestIds.closeButton);
      await this.verifyIsClosed();
    });
}
