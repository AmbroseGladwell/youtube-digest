import { expect } from "@playwright/experimental-ct-react";
import { newOverviewDialogTestIds } from "../../src/features/newOverview/components/NewOverviewDialog/NewOverviewDialogTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { GenerateOverviewFormPageObject } from "./GenerateOverviewFormPageObject.testHelper.js";

export class NewOverviewDialogPageObject extends PageObject {
  get form(): GenerateOverviewFormPageObject {
    return new GenerateOverviewFormPageObject(this.testContext);
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
    this.step(`verifyStepDetail ${stepNumber} ${detail}`, () =>
      expect(this.get(newOverviewDialogTestIds.stepDetail(stepNumber))).toHaveText(detail),
    );

  verifyStepDetailMatches = (stepNumber: string, pattern: RegExp) =>
    this.step(`verifyStepDetailMatches ${stepNumber} ${pattern.source}`, () =>
      expect(this.get(newOverviewDialogTestIds.stepDetail(stepNumber))).toHaveText(pattern),
    );

  verifyStepCountIs = (count: number) =>
    this.step(`verifyStepCountIs ${count}`, () =>
      expect(this.get(newOverviewDialogTestIds.steps).getByRole("listitem")).toHaveCount(count),
    );

  verifyStepState = (stepNumber: string, state: "waiting" | "running" | "done") =>
    this.step(`verifyStepState ${stepNumber} ${state}`, () =>
      expect(this.get(newOverviewDialogTestIds.step(stepNumber))).toHaveAttribute("data-state", state),
    );

  verifyFootNote = (pattern: RegExp) =>
    this.step(`verifyFootNote ${pattern.source}`, () =>
      expect(this.get(newOverviewDialogTestIds.footNote)).toHaveText(pattern),
    );

  verifyElapsedIsShown = () =>
    this.step("verifyElapsedIsShown", () =>
      expect(this.get(newOverviewDialogTestIds.elapsed)).toHaveText(/^\d+:\d\d elapsed$/),
    );

  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));

  clickRunInBackground = () =>
    this.step("clickRunInBackground", () => this.click(newOverviewDialogTestIds.runInBackgroundButton));

  clickCancelRun = () =>
    this.step("clickCancelRun", () => this.click(newOverviewDialogTestIds.cancelRunButton));

  clickCloseWhenDone = () =>
    this.step("clickCloseWhenDone", () => this.click(newOverviewDialogTestIds.closeWhenDoneButton));

  clickReadOverview = () =>
    this.step("clickReadOverview", () => this.click(newOverviewDialogTestIds.readOverviewButton));
}
