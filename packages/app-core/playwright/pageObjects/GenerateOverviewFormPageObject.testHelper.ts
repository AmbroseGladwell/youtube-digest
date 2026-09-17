import { expect } from "@playwright/experimental-ct-react";
import { generateOverviewFormTestIds } from "../../src/features/newOverview/components/GenerateOverviewForm/GenerateOverviewFormTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class GenerateOverviewFormPageObject extends PageObject {
  verifyIsShown = (): Promise<GenerateOverviewFormPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(generateOverviewFormTestIds.root);
      return this;
    });

  verifyIsHidden = () =>
    this.step("verifyIsHidden", () => expect(this.get(generateOverviewFormTestIds.urlInput)).toBeHidden());

  verifyUrlInputVisible = () =>
    this.step("verifyUrlInputVisible", () => this.expectToBeVisible(generateOverviewFormTestIds.urlInput));

  fillUrl = (url: string) =>
    this.step(`fillUrl ${url}`, () => this.get(generateOverviewFormTestIds.urlInput).fill(url));

  clickGenerate = () => this.step("clickGenerate", () => this.click(generateOverviewFormTestIds.generateButton));

  verifyUrlInputHolds = (url: string) =>
    this.step(`verifyUrlInputHolds ${url}`, () =>
      expect(this.get(generateOverviewFormTestIds.urlInput)).toHaveValue(url),
    );

  submitUrl = (url: string) =>
    this.step(`submitUrl ${url}`, async () => {
      await this.fillUrl(url);
      await this.clickGenerate();
    });

  verifyValidationError = (message: string) =>
    this.step(`verifyValidationError ${message}`, () =>
      expect(this.get(generateOverviewFormTestIds.validationError)).toHaveText(message),
    );

  verifyGenerationError = (message: string) =>
    this.step(`verifyGenerationError ${message}`, () =>
      expect(this.get(generateOverviewFormTestIds.generationError)).toHaveText(message),
    );

  clickCancel = () => this.step("clickCancel", () => this.click(generateOverviewFormTestIds.cancelButton));

  verifyGenerationErrorIsVisible = () =>
    this.step("verifyGenerationErrorIsVisible", () => this.expectToBeVisible(generateOverviewFormTestIds.generationError));

  verifyGenerateButtonEnabled = () =>
    this.step("verifyGenerateButtonEnabled", () =>
      expect(this.get(generateOverviewFormTestIds.generateButton)).toBeEnabled(),
    );

  verifyUrlInputDisabled = () =>
    this.step("verifyUrlInputDisabled", () => expect(this.get(generateOverviewFormTestIds.urlInput)).toBeDisabled());

  clickSettingsLink = () =>
    this.step("clickSettingsLink", () => this.click(generateOverviewFormTestIds.settingsLink));
}
