import { expect } from "@playwright/experimental-ct-react";
import { savedItemPageTestIds } from "../../src/features/captures/components/SavedItemPage/SavedItemPageTestIds.js";
import { libraryCaptureCardTestIds } from "../../src/features/library/components/LibraryCaptureCard/LibraryCaptureCardTestIds.js";
import { filterPanelTestIds } from "../../src/features/library/components/FilterPanel/FilterPanelTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class SavedItemPageObject extends PageObject {
  verifyLibraryRow = (title: string) =>
    this.step("verifyLibraryRow", async () => {
      const card = this.get(libraryCaptureCardTestIds.root).filter({ hasText: title });
      await expect(card).toBeVisible();
      await expect(card.getByTestId(libraryCaptureCardTestIds.status)).toHaveText("No overview yet · Transcript ready");
    });

  showOnlyWithoutOverview = () => this.step("showOnlyWithoutOverview", () => this.click(filterPanelTestIds.withoutOverviewChip));

  openFromLibrary = (title: string) =>
    this.step("openFromLibrary", () =>
      this.click(this.get(libraryCaptureCardTestIds.root).filter({ hasText: title }).getByTestId(libraryCaptureCardTestIds.titleLink)),
    );

  verifyIsShown = (title: string) =>
    this.step("verifyIsShown", async () => {
      await expect(this.get(savedItemPageTestIds.title)).toHaveText(title);
      await expect(this.get(savedItemPageTestIds.noOverview)).toContainText("No overview yet.");
      await this.expectToBeVisible(savedItemPageTestIds.getPlus);
      await this.expectToBeVisible(savedItemPageTestIds.transcript);
    });

  verifyOffersMakingIt = () =>
    this.step("verifyOffersMakingIt", async () => {
      await expect(this.get(savedItemPageTestIds.noOverview)).toContainText("Make its overview now.");
      await this.expectToBeVisible(savedItemPageTestIds.makeOverview);
    });

  makeOverview = () => this.step("makeOverview", () => this.click(savedItemPageTestIds.makeOverview));

  remove = () => this.step("remove", () => this.click(savedItemPageTestIds.remove));
}
