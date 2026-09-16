import { libraryPageTestIds } from "../../src/features/library/LibraryPage/LibraryPageTestIds.js";
import { libraryOverviewCardTestIds } from "../../src/features/library/components/LibraryOverviewCard/LibraryOverviewCardTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { FilterPanelPageObject } from "./FilterPanelPageObject.testHelper.js";
import { GenerateOverviewFormPageObject } from "./GenerateOverviewFormPageObject.testHelper.js";
import { LibraryOverviewCardPageObject } from "./LibraryOverviewCardPageObject.testHelper.js";

export class LibraryPageObject extends PageObject {
  get filterPanel(): FilterPanelPageObject {
    return new FilterPanelPageObject(this.testContext);
  }

  get generateForm(): GenerateOverviewFormPageObject {
    return new GenerateOverviewFormPageObject(this.testContext);
  }

  verifyIsShown = (): Promise<LibraryPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(libraryPageTestIds.root);
      return this;
    });

  verifyEmptyState = () => this.step("verifyEmptyState", () => this.expectToBeVisible(libraryPageTestIds.empty));

  expectCardCountToBe = (count: number) =>
    this.step(`expectCardCountToBe ${count}`, () => this.expectToHaveCount(libraryOverviewCardTestIds.root, count));

  nthCard = (index: number): LibraryOverviewCardPageObject =>
    new LibraryOverviewCardPageObject(this.testContext, this.get(libraryOverviewCardTestIds.root).nth(index));

  cardWithTitle = (title: string): LibraryOverviewCardPageObject =>
    new LibraryOverviewCardPageObject(
      this.testContext,
      this.get(libraryOverviewCardTestIds.root).filter({ hasText: title }),
    );
}
