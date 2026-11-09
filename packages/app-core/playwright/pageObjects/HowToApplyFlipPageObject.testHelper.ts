import { expect } from "@playwright/experimental-ct-react";
import { howToApplyFlipTestIds } from "../../src/features/reader/components/HowToApplyFlip/HowToApplyFlipTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class HowToApplyFlipPageObject extends PageObject {
  verifySampleLine = () =>
    this.step("verifySampleLine", () =>
      expect(this.get(howToApplyFlipTestIds.sampleLine)).toHaveText(
        "Written for anyone, like every sample. The overviews you make are written for you.",
      ),
    );

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectNotToBeVisible(howToApplyFlipTestIds.root));

  verifyWriting = () =>
    this.step("verifyWriting", async () => {
      await expect(this.get(howToApplyFlipTestIds.forAnyone)).toHaveAttribute("aria-disabled", "true");
      await expect(this.get(howToApplyFlipTestIds.forAnyone)).toHaveAccessibleName("For anyone, still being written");
    });

  verifyReady = () =>
    this.step("verifyReady", () => expect(this.get(howToApplyFlipTestIds.forAnyone)).toHaveAttribute("aria-disabled", "false"));

  chooseForAnyone = () => this.step("chooseForAnyone", () => this.click(howToApplyFlipTestIds.forAnyone));

  chooseForYouWithArrowKey = () =>
    this.step("chooseForYouWithArrowKey", async () => {
      await this.get(howToApplyFlipTestIds.forAnyone).press("ArrowLeft");
      await expect(this.get(howToApplyFlipTestIds.forYou)).toBeFocused();
    });

  verifyLineReads = (text: string) =>
    this.step(`verifyLineReads ${text}`, () => expect(this.get(howToApplyFlipTestIds.line)).toHaveText(text));

  verifyStepsRead = (...steps: string[]) =>
    this.step(`verifyStepsRead ${steps.join(" ")}`, () =>
      expect(this.get(howToApplyFlipTestIds.steps).getByRole("listitem")).toHaveText(steps),
    );

  verifyNoteStepsShown = () => this.step("verifyNoteStepsShown", () => this.expectNotToBeVisible(howToApplyFlipTestIds.steps));
}
