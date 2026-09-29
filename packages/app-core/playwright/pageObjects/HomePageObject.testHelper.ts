import { expect } from "@playwright/experimental-ct-react";
import { homePageTestIds } from "../../src/features/home/HomePage/HomePageTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { LibraryPageObject } from "./LibraryPageObject.testHelper.js";
import { NewOverviewDialogPageObject } from "./NewOverviewDialogPageObject.testHelper.js";

export class HomePageObject extends PageObject {
  verifyIsShown = (): Promise<HomePageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(homePageTestIds.root);
      return this;
    });

  verifyShowsFirstRunHero = (): Promise<HomePageObject> =>
    this.step("verifyShowsFirstRunHero", async () => {
      await this.expectToBeVisible(homePageTestIds.hero);
      return this;
    });

  verifyShowsSeparateLibraryNote = (): Promise<HomePageObject> =>
    this.step("verifyShowsSeparateLibraryNote", async () => {
      await this.expectToBeVisible(homePageTestIds.separateLibraryNote);
      return this;
    });

  verifyHasNoSeparateLibraryNote = (): Promise<HomePageObject> =>
    this.step("verifyHasNoSeparateLibraryNote", async () => {
      await this.expectNotToBeVisible(homePageTestIds.separateLibraryNote);
      return this;
    });

  // The hero's own field (design 2b): the same run + New starts, taken from the page.
  verifyHeroFieldDisabled = () =>
    this.step("verifyHeroFieldDisabled", async () => {
      await expect(this.get(homePageTestIds.urlInput)).toBeDisabled();
      await expect(this.get(homePageTestIds.generateButton)).toBeDisabled();
    });

  verifyHeroFieldEnabled = () =>
    this.step("verifyHeroFieldEnabled", async () => {
      await expect(this.get(homePageTestIds.urlInput)).toBeEnabled();
      await expect(this.get(homePageTestIds.generateButton)).toBeEnabled();
    });

  verifyShowsKeysNote = () =>
    this.step("verifyShowsKeysNote", () => this.expectToBeVisible(homePageTestIds.keysNote));

  verifySaysKeysAreSaved = () =>
    this.step("verifySaysKeysAreSaved", async () => {
      await this.expectToBeVisible(homePageTestIds.keysSavedLine);
      await this.expectNotToBeVisible(homePageTestIds.keysNote);
    });

  submitHeroUrl = (url: string) =>
    this.step(`submitHeroUrl ${url}`, async () => {
      await this.get(homePageTestIds.urlInput).fill(url);
      await this.click(homePageTestIds.generateButton);
    });

  verifyHeroValidationError = (message: string) =>
    this.step(`verifyHeroValidationError ${message}`, () =>
      expect(this.get(homePageTestIds.validationError)).toHaveText(message),
    );

  expectRunDialog = (): Promise<NewOverviewDialogPageObject> =>
    this.step("expectRunDialog", () =>
      new NewOverviewDialogPageObject(this.testContext).verifyIsShown(),
    );

  verifyShowsLibrary = (): Promise<LibraryPageObject> =>
    this.step("verifyShowsLibrary", async () => {
      const library = new LibraryPageObject(this.testContext);
      await library.verifyIsShown();
      return library;
    });
}
