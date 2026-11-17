import { expect } from "@playwright/experimental-ct-react";
import { projectSuggestionsTestIds } from "../../src/features/projects/components/ProjectSuggestions/ProjectSuggestionsTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class ProjectSuggestionsPageObject extends PageObject {
  #row = (title: string) => this.page.getByTestId(projectSuggestionsTestIds.row).filter({ hasText: title });

  verifyOffers = (titles: string[]) =>
    this.step(`verifyOffers ${titles.join(", ")}`, () =>
      expect(this.page.getByTestId(projectSuggestionsTestIds.titleLink)).toHaveText(titles),
    );

  verifyIsNotShown = () =>
    this.step("verifyIsNotShown", () => expect(this.page.getByTestId(projectSuggestionsTestIds.root)).toHaveCount(0));

  verifySublineReads = (text: string) =>
    this.step(`verifySublineReads ${text}`, () => expect(this.page.getByTestId(projectSuggestionsTestIds.subline)).toHaveText(text));

  verifyHeadingIsFocused = () =>
    this.step("verifyHeadingIsFocused", () => expect(this.page.getByTestId(projectSuggestionsTestIds.heading)).toBeFocused());

  verifyAddIsFocused = (title: string) =>
    this.step(`verifyAddIsFocused ${title}`, () => expect(this.#row(title).getByTestId(projectSuggestionsTestIds.addButton)).toBeFocused());

  clickAdd = (title: string) =>
    this.step(`clickAdd ${title}`, () => this.#row(title).getByTestId(projectSuggestionsTestIds.addButton).click());

  clickAddAll = () => this.step("clickAddAll", () => this.page.getByTestId(projectSuggestionsTestIds.addAllButton).click());

  clickNotForThisProject = (title: string) =>
    this.step(`clickNotForThisProject ${title}`, () => this.#row(title).getByTestId(projectSuggestionsTestIds.turnDownButton).click());

  clickSayWhatItsFor = () => this.step("clickSayWhatItsFor", () => this.page.getByTestId(projectSuggestionsTestIds.addPurposeLink).click());
}
