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

  // Design 205c-2, and a width media query rather than a prop, so the drawn box is what says
  // which shape it took: a sheet spans the viewport and rests on its floor.
  verifyIsTheSheet = () =>
    this.step("verifyIsTheSheet", async () => {
      await this.expectToBeVisible(newOverviewDialogTestIds.handle);
      const { panel, viewport } = await this.panelAgainstViewport();
      expect(Math.round(panel.width)).toBe(viewport.width);
      expect(Math.round(panel.y + panel.height)).toBe(viewport.height);
    });

  verifyIsTheCentredDialog = () =>
    this.step("verifyIsTheCentredDialog", async () => {
      await this.expectNotToBeVisible(newOverviewDialogTestIds.handle);
      const { panel, viewport } = await this.panelAgainstViewport();
      expect(panel.width).toBeLessThan(viewport.width);
      expect(Math.round(panel.y + panel.height)).toBeLessThan(viewport.height);
      expect(Math.round(panel.x)).toBe(Math.round(viewport.width - (panel.x + panel.width)));
    });

  private panelAgainstViewport = async () => {
    // The sheet's travel is on the <dialog> itself, so the resting box is only readable once
    // the root's own animation has finished.
    await this.get(newOverviewDialogTestIds.root).evaluate((element) =>
      Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
    );
    return { panel: (await this.get(newOverviewDialogTestIds.panel).boundingBox())!, viewport: this.page.viewportSize()! };
  };

  clickScrim = () =>
    this.step("clickScrim", async () => {
      const { panel, viewport } = await this.panelAgainstViewport();
      await this.page.mouse.click(viewport.width / 2, panel.y / 2);
    });

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

  verifyCloseHasFocus = () =>
    this.step("verifyCloseHasFocus", () => expect(this.get(newOverviewDialogTestIds.closeButton)).toBeFocused());

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

  verifyAlreadyHeld = () =>
    this.step("verifyAlreadyHeld", () => this.expectToBeVisible(newOverviewDialogTestIds.alreadyHeld));

  clickOpenHeld = () =>
    this.step("clickOpenHeld", () => this.click(newOverviewDialogTestIds.openHeldButton));
}
