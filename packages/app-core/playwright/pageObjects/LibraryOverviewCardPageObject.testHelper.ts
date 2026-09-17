import { expect } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import { libraryOverviewCardTestIds } from "../../src/features/library/components/LibraryOverviewCard/LibraryOverviewCardTestIds.js";
import { overviewThumbnailTestIds } from "../../src/components/shared/OverviewThumbnail/OverviewThumbnailTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { ReaderPageObject } from "./ReaderPageObject.testHelper.js";

export class LibraryOverviewCardPageObject extends PageObject {
  // The entrance marker is on the card's own root, which getByTestId would look past.
  private get card(): Locator {
    return this.locator ?? this.page.getByTestId(libraryOverviewCardTestIds.root);
  }

  verifyIsEntering = (isEntering: boolean) =>
    this.step(`verifyIsEntering ${isEntering}`, () =>
      isEntering
        ? expect(this.card).toHaveAttribute("data-entering", "true")
        : expect(this.card).not.toHaveAttribute("data-entering", "true"),
    );

  verifyTitle = (title: string) =>
    this.step(`verifyTitle ${title}`, () =>
      expect(this.get(libraryOverviewCardTestIds.titleLink)).toContainText(title),
    );

  openReader = (): Promise<ReaderPageObject> =>
    this.step("openReader", async () => {
      await this.click(libraryOverviewCardTestIds.listenLink);
      return new ReaderPageObject(this.testContext).verifyIsShown();
    });

  openReaderFromTitle = (): Promise<ReaderPageObject> =>
    this.step("openReaderFromTitle", async () => {
      await this.click(libraryOverviewCardTestIds.titleLink);
      return new ReaderPageObject(this.testContext).verifyIsShown();
    });

  openReaderFromThumbnail = (): Promise<ReaderPageObject> =>
    this.step("openReaderFromThumbnail", async () => {
      await this.click(overviewThumbnailTestIds.link);
      return new ReaderPageObject(this.testContext).verifyIsShown();
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

  verifyHasThumbnail = () => this.expectToBeVisible(overviewThumbnailTestIds.image);
  verifyHasNoThumbnail = () => this.expectNotToBeVisible(overviewThumbnailTestIds.image);
}
