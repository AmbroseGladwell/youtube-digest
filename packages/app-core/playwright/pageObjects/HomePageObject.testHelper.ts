import { expect } from "@playwright/experimental-ct-react";
import { homePageTestIds } from "../../src/features/home/HomePage/HomePageTestIds.js";
import { sourceOfferTestIds } from "../../src/features/capture/components/SourceOffer/SourceOfferTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { LibraryPageObject } from "./LibraryPageObject.testHelper.js";
import { NewOverviewDialogPageObject } from "./NewOverviewDialogPageObject.testHelper.js";

export class HomePageObject extends PageObject {
  verifyIsShown = (): Promise<HomePageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(homePageTestIds.root);
      return this;
    });

  // Signed out, the hero is onboarding's Start: it makes the first overview, and offers
  // nothing that needs keys (design 46a).
  verifyShowsExampleOverview = (shown: boolean) =>
    this.step(`verifyShowsExampleOverview ${shown}`, () =>
      shown ? this.expectToBeVisible(homePageTestIds.exampleOverview) : this.expectToHaveCount(homePageTestIds.exampleOverview, 0),
    );

  verifySaysNewAccountsStartWithAnOverview = () =>
    this.step("verifySaysNewAccountsStartWithAnOverview", () =>
      expect(this.get(homePageTestIds.fromCreateNote)).toHaveText("New accounts start with your first overview"),
    );

  verifyShowsStart = (): Promise<HomePageObject> =>
    this.step("verifyShowsStart", async () => {
      await this.expectToBeVisible(homePageTestIds.hero);
      await expect(this.get(homePageTestIds.generateButton)).toHaveText("Make my overview");
      await this.expectNotToBeVisible(homePageTestIds.keysNote);
      return this;
    });

  // Design 155l: the headline's verb follows the deck's front card, or in the panel what the
  // tab holds (205g-2, 205g-3). "with The Overview" never moves.
  verifyHeadlineReads = (verb: string) =>
    this.step(`verifyHeadlineReads ${verb}`, () =>
      expect(this.get(homePageTestIds.heroTitle)).toHaveText(new RegExp(`^${verb}\\s*with The Overview$`)),
    );

  verifyStandfirstReads = (standfirst: string) =>
    this.step(`verifyStandfirstReads ${standfirst}`, () =>
      expect(this.get(homePageTestIds.hero).locator("p").first()).toHaveText(standfirst),
    );

  // 205g-2 and 205g-3: beside something, Start shows the same offer card as signed in, and
  // never its length or reading time.
  verifyOffers = ({ site, title }: { site: string; title: string }) =>
    this.step(`verifyOffers ${title}`, async () => {
      await expect(this.get(sourceOfferTestIds.site)).toHaveText(site);
      await expect(this.get(sourceOfferTestIds.title)).toHaveText(title);
      await this.expectToHaveCount(sourceOfferTestIds.facts, 0);
    });

  verifyOffersNothingFromTheTab = () =>
    this.step("verifyOffersNothingFromTheTab", () => this.expectToHaveCount(sourceOfferTestIds.card, 0));

  makeOverview = () => this.step("makeOverview", () => this.click(homePageTestIds.generateButton));

  pasteADifferentLink = () => this.step("pasteADifferentLink", () => this.click(homePageTestIds.pasteLink));

  verifyOffersNoPasteLink = () =>
    this.step("verifyOffersNoPasteLink", () => this.expectToHaveCount(homePageTestIds.pasteLink, 0));

  // 205g: Sign in is a peer of Make my overview rather than a line of small type.
  verifyOffersSignIn = () => this.step("verifyOffersSignIn", () => this.expectToBeVisible(homePageTestIds.signIn));

  signIn = () => this.step("signIn", () => this.click(homePageTestIds.signIn));

  verifyStartIsAbsent = () => this.step("verifyStartIsAbsent", () => this.expectNotToBeVisible(homePageTestIds.hero));

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

  verifyUsageLineReads = (text: string) =>
    this.step(`verifyUsageLineReads ${text}`, () => expect(this.get(homePageTestIds.usageLine.root)).toHaveText(text));

  verifyLimitMessage = ({ title, actions }: { title: string; actions: string[] }) =>
    this.step(`verifyLimitMessage ${title}`, async () => {
      await expect(this.get(homePageTestIds.limitMessage.title)).toHaveText(title);
      await expect(this.get(homePageTestIds.limitMessage.root).getByRole("link")).toHaveText(actions);
      await this.expectToHaveCount(homePageTestIds.generateButton, 0);
    });

  // The hero carries the same dead end as Settings, so a reader meets it where they tried
  // to generate (design 110k).
  verifyKeyPromptDeadEnd = () =>
    this.step("verifyKeyPromptDeadEnd", async () => {
      await this.expectToBeVisible(homePageTestIds.keyPrompt.heading);
      await this.expectToBeVisible(homePageTestIds.keyPrompt.useFallback);
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
