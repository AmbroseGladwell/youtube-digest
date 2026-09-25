import { expect } from "@playwright/experimental-ct-react";
import { capturePageTestIds } from "../../src/features/capture/CapturePage/CapturePageTestIds.js";
import { captureReasonFieldTestIds } from "../../src/features/newOverview/components/CaptureReasonField/CaptureReasonFieldTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { GenerationStepsPageObject } from "./GenerationStepsPageObject.testHelper.js";
import { ReaderPageObject } from "./ReaderPageObject.testHelper.js";
import { SettingsPageObject } from "./SettingsPageObject.testHelper.js";

export class CapturePageObject extends PageObject {
  get steps(): GenerationStepsPageObject {
    return new GenerationStepsPageObject(this.testContext);
  }

  verifyIsShown = (): Promise<CapturePageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(capturePageTestIds.root);
      return this;
    });

  verifyOffersToCreate = (enabled: boolean) =>
    this.step(`verifyOffersToCreate ${enabled}`, () =>
      enabled
        ? expect(this.get(capturePageTestIds.createButton)).toBeEnabled()
        : expect(this.get(capturePageTestIds.createButton)).toBeDisabled(),
    );

  verifySaysThereIsNoVideo = () =>
    this.step("verifySaysThereIsNoVideo", () =>
      this.expectToBeVisible(capturePageTestIds.noVideoNote),
    );

  verifySaysNothingAboutMissingVideo = () =>
    this.step("verifySaysNothingAboutMissingVideo", () =>
      this.expectNotToBeVisible(capturePageTestIds.noVideoNote),
    );

  verifyCaptionsNoteReads = (pattern: RegExp) =>
    this.step(`verifyCaptionsNoteReads ${pattern.source}`, () =>
      expect(this.get(capturePageTestIds.captionsNote)).toHaveText(pattern),
    );

  verifyAsksForKeys = (asks: boolean) =>
    this.step(`verifyAsksForKeys ${asks}`, () =>
      asks
        ? this.expectToBeVisible(capturePageTestIds.keysNote)
        : this.expectNotToBeVisible(capturePageTestIds.keysNote),
    );

  verifySaysItIsAlreadyInTheLibrary = () =>
    this.step("verifySaysItIsAlreadyInTheLibrary", () =>
      this.expectToBeVisible(capturePageTestIds.alreadyInLibraryNote),
    );

  clickCreate = () => this.step("clickCreate", () => this.click(capturePageTestIds.createButton));

  clickWriteANewOne = () =>
    this.step("clickWriteANewOne", () => this.click(capturePageTestIds.createAgainButton));

  openStoredOverview = (): Promise<ReaderPageObject> =>
    this.step("openStoredOverview", async () => {
      await this.click(capturePageTestIds.readOverviewButton);
      return new ReaderPageObject(this.testContext).verifyIsShown();
    });

  verifyIsWorking = () =>
    this.step("verifyIsWorking", () => this.expectToBeVisible(capturePageTestIds.working));

  verifyWorkingTitleReads = (title: string) =>
    this.step(`verifyWorkingTitleReads ${title}`, () =>
      expect(this.get(capturePageTestIds.workingTitle)).toHaveText(title),
    );

  verifySaysToKeepThePanelOpen = () =>
    this.step("verifySaysToKeepThePanelOpen", () =>
      expect(this.get(capturePageTestIds.keepOpenNote)).toHaveText(/Closing it stops the run\./),
    );

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

  verifyElapsedIsShown = () =>
    this.step("verifyElapsedIsShown", () =>
      expect(this.get(capturePageTestIds.elapsed)).toHaveText(/^\d+:\d\d elapsed$/),
    );

  verifyShowsGenerationError = () =>
    this.step("verifyShowsGenerationError", () => this.expectToBeVisible(capturePageTestIds.error));

  clickCancel = () => this.step("clickCancel", () => this.click(capturePageTestIds.cancelButton));

  clickStartAgain = () =>
    this.step("clickStartAgain", () => this.click(capturePageTestIds.startAgainButton));

  openSettings = (): Promise<SettingsPageObject> =>
    this.step("openSettings", async () => {
      await this.click(capturePageTestIds.settingsLink);
      return new SettingsPageObject(this.testContext).verifyIsShown();
    });

  waitForReader = (): Promise<ReaderPageObject> =>
    this.step("waitForReader", () => new ReaderPageObject(this.testContext).verifyIsShown());
}
