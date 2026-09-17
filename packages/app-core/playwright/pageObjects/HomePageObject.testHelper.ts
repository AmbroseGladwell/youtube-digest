import { homePageTestIds } from "../../src/features/home/HomePage/HomePageTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { LibraryPageObject } from "./LibraryPageObject.testHelper.js";

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

  verifyShowsLibrary = (): Promise<LibraryPageObject> =>
    this.step("verifyShowsLibrary", async () => {
      const library = new LibraryPageObject(this.testContext);
      await library.verifyIsShown();
      return library;
    });
}
