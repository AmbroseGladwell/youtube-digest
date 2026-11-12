import { expect } from "@playwright/experimental-ct-react";
import { readAlongNoteTestIds } from "../../src/features/reader/components/ReadAlongNote/ReadAlongNoteTestIds.js";
import { dubiousStepFlagTestIds } from "../../src/features/reader/components/DubiousStepFlag/DubiousStepFlagTestIds.js";
import { howToApplyFlipTestIds } from "../../src/features/reader/components/HowToApplyFlip/HowToApplyFlipTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

// The steps a source gives, on the reader page or a shared copy (design OV-250).
export class SourceStepsPageObject extends PageObject {
  private stepLines = () =>
    this.get(readAlongNoteTestIds.line)
      .or(this.get(readAlongNoteTestIds.activeLine))
      .filter({ has: this.page.getByTestId(readAlongNoteTestIds.stepNumber) });

  // Beside the numbered steps, the other lists are marked with a dot rather than a number.
  verifyOtherListsAreDotted = (dotted: boolean) =>
    this.step(`verifyOtherListsAreDotted ${dotted}`, async () => {
      const marks = this.get(readAlongNoteTestIds.bullet);
      await expect(marks.first()).toBeVisible();
      for (const mark of await marks.all()) {
        if (dotted) await expect(mark).toHaveText("");
        else await expect(mark).toHaveText(/^\d+\.$/);
      }
    });

  verifyCaptionReads = (caption: string) =>
    this.step(`verifyCaptionReads ${caption}`, () => expect(this.get(readAlongNoteTestIds.aside)).toHaveText(caption));

  verifyIsNotShown = () =>
    this.step("verifyIsNotShown", async () => {
      await this.expectToHaveCount(readAlongNoteTestIds.aside, 0);
      await expect(this.stepLines()).toHaveCount(0);
    });

  verifyShownStepsRead = (texts: string[]) =>
    this.step(`verifyShownStepsRead ${texts.join(" | ")}`, () =>
      expect(this.stepLines().locator(":visible").getByTestId(readAlongNoteTestIds.lineText)).toHaveText(texts),
    );

  verifyShowAllReads = (text: string) =>
    this.step(`verifyShowAllReads ${text}`, async () => {
      await expect(this.get(readAlongNoteTestIds.showAllSteps)).toHaveText(text);
      await expect(this.get(readAlongNoteTestIds.showAllSteps)).toHaveAttribute("aria-expanded", "false");
    });

  verifyNoShowAll = () => this.step("verifyNoShowAll", () => this.expectToHaveCount(readAlongNoteTestIds.showAllSteps, 0));

  clickShowAll = () =>
    this.step("clickShowAll", async () => {
      await this.click(readAlongNoteTestIds.showAllSteps);
      await this.expectToHaveCount(readAlongNoteTestIds.showAllSteps, 0);
    });

  verifyFocusIsOnStep = (text: string) =>
    this.step(`verifyFocusIsOnStep ${text}`, () =>
      expect(this.stepLines().filter({ hasText: text }).getByTestId(readAlongNoteTestIds.lineText)).toBeFocused(),
    );

  verifyDubiousFlagCount = (count: number) =>
    this.step(`verifyDubiousFlagCount ${count}`, () => this.expectToHaveCount(dubiousStepFlagTestIds.flag, count));

  clickDubiousFlagOn = (stepText: string) =>
    this.step(`clickDubiousFlagOn ${stepText}`, async () => {
      const flag = this.stepLines().filter({ hasText: stepText }).getByTestId(dubiousStepFlagTestIds.flag);
      await flag.click();
      await expect(flag).toHaveAttribute("aria-expanded", "true");
    });

  verifyDubiousReasonReads = (reason: string, saidAt: string | null) =>
    this.step(`verifyDubiousReasonReads ${reason} ${saidAt}`, async () => {
      await expect(this.get(dubiousStepFlagTestIds.reason)).toHaveText(reason);
      if (saidAt === null) await this.expectToHaveCount(dubiousStepFlagTestIds.saidAt, 0);
      else await expect(this.get(dubiousStepFlagTestIds.saidAt)).toHaveText(saidAt);
    });

  verifyHowToApplyIsPersonalised = (personalised: boolean) =>
    this.step(`verifyHowToApplyIsPersonalised ${personalised}`, async () => {
      if (personalised) {
        await this.expectToBeVisible(howToApplyFlipTestIds.personalised);
        await this.expectToHaveCount(howToApplyFlipTestIds.forAnyoneLine, 0);
      } else {
        await this.expectToHaveCount(howToApplyFlipTestIds.personalised, 0);
        await expect(this.get(howToApplyFlipTestIds.forAnyoneLine)).toHaveText(
          "Tell us about yourself in Settings and these fit around you.",
        );
      }
    });
}
