import { expect } from "@playwright/experimental-ct-react";
import { captureReasonFieldTestIds } from "../../src/features/newOverview/components/CaptureReasonField/CaptureReasonFieldTestIds.js";
import { newOverviewDialogTestIds } from "../../src/features/newOverview/components/NewOverviewDialog/NewOverviewDialogTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { GenerateOverviewFormPageObject } from "./GenerateOverviewFormPageObject.testHelper.js";
import { GenerationStepsPageObject } from "./GenerationStepsPageObject.testHelper.js";

export class NewOverviewDialogPageObject extends PageObject {
  get form(): GenerateOverviewFormPageObject {
    return new GenerateOverviewFormPageObject(this.testContext);
  }

  get steps(): GenerationStepsPageObject {
    return new GenerationStepsPageObject(this.testContext);
  }

  verifyIsShown = (): Promise<NewOverviewDialogPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(newOverviewDialogTestIds.root);
      return this;
    });

  verifyIsHidden = () =>
    this.step("verifyIsHidden", () => expect(this.get(newOverviewDialogTestIds.root)).toBeHidden());

  verifySourceTitle = (title: string) =>
    this.step(`verifySourceTitle ${title}`, () =>
      expect(this.get(newOverviewDialogTestIds.sourceTitle)).toHaveText(title),
    );

  verifyStepDetail = (stepNumber: string, detail: string) =>
    this.steps.verifyStepDetail(stepNumber, detail);

  verifyStepDetailMatches = (stepNumber: string, pattern: RegExp) =>
    this.steps.verifyStepDetailMatches(stepNumber, pattern);

  verifyStepCountIs = (count: number) => this.steps.verifyStepCountIs(count);

  verifyStepState = (stepNumber: string, state: "waiting" | "running" | "done") =>
    this.steps.verifyStepState(stepNumber, state);

  verifyFootNote = (pattern: RegExp) =>
    this.step(`verifyFootNote ${pattern.source}`, () =>
      expect(this.get(newOverviewDialogTestIds.footNote)).toHaveText(pattern),
    );

  verifyElapsedIsShown = () =>
    this.step("verifyElapsedIsShown", () =>
      expect(this.get(newOverviewDialogTestIds.elapsed)).toHaveText(/^\d+:\d\d elapsed$/),
    );

  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));

  verifyAsksForAReason = (asks: boolean) =>
    this.step(`verifyAsksForAReason ${asks}`, () =>
      asks
        ? this.expectToBeVisible(captureReasonFieldTestIds.input)
        : this.expectNotToBeVisible(captureReasonFieldTestIds.input),
    );

  fillCaptureReason = (reason: string) =>
    this.step(`fillCaptureReason ${reason}`, () =>
      this.get(captureReasonFieldTestIds.input).fill(reason),
    );

  verifyCaptureReasonHolds = (reason: string) =>
    this.step(`verifyCaptureReasonHolds ${reason}`, () =>
      expect(this.get(captureReasonFieldTestIds.input)).toHaveValue(reason),
    );

  clickRunInBackground = () =>
    this.step("clickRunInBackground", () =>
      this.click(newOverviewDialogTestIds.runInBackgroundButton),
    );

  clickCancelRun = () =>
    this.step("clickCancelRun", () => this.click(newOverviewDialogTestIds.cancelRunButton));

  clickCloseWhenDone = () =>
    this.step("clickCloseWhenDone", () => this.click(newOverviewDialogTestIds.closeWhenDoneButton));

  clickReadOverview = () =>
    this.step("clickReadOverview", () => this.click(newOverviewDialogTestIds.readOverviewButton));
}
