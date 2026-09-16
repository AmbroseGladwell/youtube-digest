import { expect } from "@playwright/experimental-ct-react";
import { libraryOverviewCardTestIds } from "../../src/features/library/components/LibraryOverviewCard/LibraryOverviewCardTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class LibraryOverviewCardPageObject extends PageObject {
  verifyTitle = (title: string) =>
    this.step(`verifyTitle ${title}`, () =>
      expect(this.get(libraryOverviewCardTestIds.expandToggle)).toContainText(title),
    );

  clickToExpand = () =>
    this.step("clickToExpand", async () => {
      await this.click(libraryOverviewCardTestIds.expandToggle);
      await this.expectToBeVisible(libraryOverviewCardTestIds.body);
    });

  clickToCollapse = () =>
    this.step("clickToCollapse", async () => {
      await this.click(libraryOverviewCardTestIds.expandToggle);
      await this.expectNotToBeVisible(libraryOverviewCardTestIds.body);
    });

  clickFavourite = () => this.step("clickFavourite", () => this.click(libraryOverviewCardTestIds.favouriteButton));
  clickMarkRead = () => this.step("clickMarkRead", () => this.click(libraryOverviewCardTestIds.readButton));

  verifyIsFavourited = (isFavourited: boolean) =>
    this.step(`verifyIsFavourited ${isFavourited}`, () =>
      expect(this.get(libraryOverviewCardTestIds.favouriteButton)).toHaveAttribute(
        "aria-pressed",
        String(isFavourited),
      ),
    );

  verifyIsRead = (isRead: boolean) =>
    this.step(`verifyIsRead ${isRead}`, () =>
      expect(this.get(libraryOverviewCardTestIds.readButton)).toHaveAttribute("aria-pressed", String(isRead)),
    );

  verifyHasThumbnail = () => this.expectToBeVisible(libraryOverviewCardTestIds.thumbnail);
  verifyHasNoThumbnail = () => this.expectNotToBeVisible(libraryOverviewCardTestIds.thumbnail);
  verifyIsExpanded = () => this.expectToBeVisible(libraryOverviewCardTestIds.body);
}
