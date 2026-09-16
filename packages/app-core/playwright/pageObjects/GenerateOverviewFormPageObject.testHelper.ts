import { expect } from "@playwright/experimental-ct-react";
import { generateOverviewFormTestIds } from "../../src/features/newOverview/components/GenerateOverviewForm/GenerateOverviewFormTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { ApiKeysPanelPageObject } from "./ApiKeysPanelPageObject.testHelper.js";

export class GenerateOverviewFormPageObject extends PageObject {
  get apiKeysPanel(): ApiKeysPanelPageObject {
    return new ApiKeysPanelPageObject(this.testContext, this.locator);
  }

  verifyIsShown = (): Promise<GenerateOverviewFormPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(generateOverviewFormTestIds.root);
      return this;
    });

  fillUrl = (url: string) =>
    this.step(`fillUrl ${url}`, () => this.get(generateOverviewFormTestIds.urlInput).fill(url));

  clickGenerate = () => this.step("clickGenerate", () => this.click(generateOverviewFormTestIds.generateButton));

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

  verifyProgressShows = (message: string) =>
    this.step(`verifyProgressShows ${message}`, () =>
      expect(this.get(generateOverviewFormTestIds.progress)).toHaveText(message),
    );

  verifyGenerationErrorIsVisible = () =>
    this.step("verifyGenerationErrorIsVisible", () => this.expectToBeVisible(generateOverviewFormTestIds.generationError));

  verifyGenerateButtonEnabled = () =>
    this.step("verifyGenerateButtonEnabled", () =>
      expect(this.get(generateOverviewFormTestIds.generateButton)).toBeEnabled(),
    );

  verifyUrlInputDisabled = () =>
    this.step("verifyUrlInputDisabled", () => expect(this.get(generateOverviewFormTestIds.urlInput)).toBeDisabled());
}
