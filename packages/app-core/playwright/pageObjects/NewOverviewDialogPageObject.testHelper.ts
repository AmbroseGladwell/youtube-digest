import { expect } from "@playwright/experimental-ct-react";
import { captureReasonFieldTestIds } from "../../src/features/newOverview/components/CaptureReasonField/CaptureReasonFieldTestIds.js";
import { newOverviewDialogTestIds } from "../../src/features/newOverview/components/NewOverviewDialog/NewOverviewDialogTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { justNowListTestIds } from "../../src/features/newOverview/components/JustNowList/JustNowListTestIds.js";
import { generateOverviewFormTestIds } from "../../src/features/newOverview/components/GenerateOverviewForm/GenerateOverviewFormTestIds.js";
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

  verifyIsHidden = () => this.step("verifyIsHidden", () => expect(this.get(newOverviewDialogTestIds.root)).toBeHidden());

  // A width media query, not a prop, chooses the shape, so the drawn box is what says which.
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
    // The sheet's travel is on the <dialog> itself, so its box settles once that animation ends.
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

  // The newest link Create was given, whatever has come before it.
  private latestRow = () => this.get(justNowListTestIds.row).and(this.page.locator(":not([data-stage=next])")).last();

  private rowNumber = async (attribute: string) => Number(await this.latestRow().getAttribute(attribute));

  verifySourceTitle = (title: string) => this.step(`verifySourceTitle ${title}`, () => expect(this.latestRow()).toContainText(title));

  verifyStatusReads = (pattern: RegExp) =>
    this.step(`verifyStatusReads ${pattern.source}`, () =>
      expect(this.latestRow().getByTestId(justNowListTestIds.status)).toHaveText(pattern),
    );

  verifyStage = (stage: "fetch" | "write" | "done" | "saved" | "failed") =>
    this.step(`verifyStage ${stage}`, () => expect(this.latestRow()).toHaveAttribute("data-stage", stage));

  verifyStepState = (stepNumber: string, state: "waiting" | "running" | "done") =>
    this.step(`verifyStepState ${stepNumber} ${state}`, async () => {
      const wanted = Number(stepNumber);
      await expect
        .poll(async () => {
          const stage = await this.latestRow().getAttribute("data-stage");
          const step = await this.rowNumber("data-step");
          if (stage === "done" || stage === "saved" || step > wanted) {
            return "done";
          }
          return step === wanted ? "running" : "waiting";
        })
        .toBe(state);
    });

  verifyKeepOffered = (time: string) =>
    this.step("verifyKeepOffered", async () => {
      await expect(this.get(justNowListTestIds.keepNotice)).toContainText("This one can’t be fetched right now.");
      await expect(this.get(justNowListTestIds.keepIt)).toHaveAccessibleName(`Keep it: made after ${time} or in the extension`);
    });

  verifyKeepNoticeReads = (pattern: RegExp) =>
    this.step(`verifyKeepNoticeReads ${pattern.source}`, () => expect(this.get(justNowListTestIds.keepNotice)).toHaveText(pattern));

  keepIt = () => this.step("keepIt", () => this.click(justNowListTestIds.keepIt));

  verifyKept = (time: string) =>
    this.step("verifyKept", () => expect(this.get(justNowListTestIds.kept)).toContainText(`Kept. It’ll be made after ${time}.`));

  verifyWaitingReads = (pattern: RegExp) =>
    this.step(`verifyWaitingReads ${pattern.source}`, () =>
      expect(
        this.page.locator(`[data-testid="${justNowListTestIds.row}"][data-stage="next"]`).getByTestId(justNowListTestIds.status),
      ).toHaveText(pattern),
    );

  verifyWaitingCount = (count: number) =>
    this.step(`verifyWaitingCount ${count}`, () =>
      expect(this.page.locator(`[data-testid="${justNowListTestIds.row}"][data-stage="next"]`)).toHaveCount(count),
    );

  verifyFootNote = (pattern: RegExp) =>
    this.step(`verifyFootNote ${pattern.source}`, () => expect(this.get(newOverviewDialogTestIds.footNote)).toHaveText(pattern));

  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));

  verifyFieldHasFocus = () => this.step("verifyFieldHasFocus", () => expect(this.get(generateOverviewFormTestIds.urlInput)).toBeFocused());

  verifyAsksForAReason = (asks: boolean) =>
    this.step(`verifyAsksForAReason ${asks}`, () =>
      asks ? this.expectToBeVisible(captureReasonFieldTestIds.input) : this.expectNotToBeVisible(captureReasonFieldTestIds.input),
    );

  openReason = () => this.step("openReason", () => this.click(justNowListTestIds.addReason));

  fillCaptureReason = (reason: string) =>
    this.step(`fillCaptureReason ${reason}`, async () => {
      if ((await this.get(captureReasonFieldTestIds.input).count()) === 0) {
        await this.click(justNowListTestIds.addReason);
      }
      await this.get(captureReasonFieldTestIds.input).fill(reason);
    });

  verifyCaptureReasonHolds = (reason: string) =>
    this.step(`verifyCaptureReasonHolds ${reason}`, () => expect(this.get(captureReasonFieldTestIds.input)).toHaveValue(reason));

  clickDone = () => this.step("clickDone", () => this.click(generateOverviewFormTestIds.cancelButton));

  clickReadOverview = () => this.step("clickReadOverview", () => this.click(this.latestRow().getByTestId(justNowListTestIds.readOverview)));

  verifyAlreadyHeld = () => this.step("verifyAlreadyHeld", () => this.expectToBeVisible(newOverviewDialogTestIds.alreadyHeld));

  clickOpenHeld = () => this.step("clickOpenHeld", () => this.click(newOverviewDialogTestIds.openHeldButton));
}
