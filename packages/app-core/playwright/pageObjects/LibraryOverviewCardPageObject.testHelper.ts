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

  // On a phone the actions sit under the text rather than beside it, so their left edge
  // has to be the title's. It is a grid column rather than a padding, and the widths that
  // have to add up — the thumbnail column, its gap, and three touch-sized pills — are set
  // in three different places, so nothing else would notice them drifting apart.
  verifyActionsLineUpWithTheTitle = () =>
    this.step("verifyActionsLineUpWithTheTitle", async () => {
      const title = (await this.get(libraryOverviewCardTestIds.titleLink).boundingBox())!;
      const favourite = (await this.get(libraryOverviewCardTestIds.favouriteButton).boundingBox())!;
      const listen = (await this.get(libraryOverviewCardTestIds.listenLink).boundingBox())!;

      expect(Math.round(favourite.x)).toBe(Math.round(title.x));
      expect(favourite.y).toBeGreaterThan(title.y);
      expect(Math.round(listen.y)).toBe(Math.round(favourite.y));
    });

  verifyActionsAreTouchSized = () =>
    this.step("verifyActionsAreTouchSized", async () => {
      for (const testId of [
        libraryOverviewCardTestIds.favouriteButton,
        libraryOverviewCardTestIds.readButton,
        libraryOverviewCardTestIds.listenLink,
      ]) {
        const box = (await this.get(testId).boundingBox())!;
        expect(Math.round(box.height)).toBe(38);
      }
    });

  // A row's chrome is its whole resting appearance, so it is read off the laid-out element
  // rather than asserted as a class: the point is that nothing is painted, not that a
  // particular rule is absent from a stylesheet.
  private chrome = () =>
    this.card.evaluate((row) => {
      const style = getComputedStyle(row);
      return {
        shadow: style.boxShadow,
        border: style.borderTopColor,
        background: style.backgroundColor,
        transform: style.transform,
      };
    });

  private static readonly TRANSPARENT = "rgba(0, 0, 0, 0)";

  verifyHasNoChrome = () =>
    this.step("verifyHasNoChrome", () =>
      expect(async () => {
        const { shadow, border, background } = await this.chrome();
        expect(shadow).toBe("none");
        expect(border).toBe(LibraryOverviewCardPageObject.TRANSPARENT);
        expect(background).toBe(LibraryOverviewCardPageObject.TRANSPARENT);
      }).toPass({ timeout: 2_000 }),
    );

  // The surface is asserted alongside the border and the shadow because it is what does the
  // lifting: a dark row's shadow at half opacity over near-black is nearly invisible, so a
  // tile that painted the ground back onto itself would look like no tile at all. The
  // transform is asserted as absent because the lift is a surface, never a move.
  verifyShowsItsTile = () =>
    this.step("verifyShowsItsTile", () =>
      expect(async () => {
        const { shadow, border, background, transform } = await this.chrome();
        expect(shadow).not.toBe("none");
        expect(border).not.toBe(LibraryOverviewCardPageObject.TRANSPARENT);
        expect(background).not.toBe(LibraryOverviewCardPageObject.TRANSPARENT);
        expect(transform).toBe("none");
      }).toPass({ timeout: 2_000 }),
    );

  hoverTitle = () =>
    this.step("hoverTitle", () => this.get(libraryOverviewCardTestIds.titleLink).hover());

  focusFirstControl = () =>
    this.step("focusFirstControl", () =>
      this.get(libraryOverviewCardTestIds.favouriteButton).focus(),
    );

  titleLeftEdge = async () =>
    Math.round((await this.get(libraryOverviewCardTestIds.titleLink).boundingBox())!.x);

  // Against the row rather than a hardcoded width: what matters is that the title has the
  // whole of it, which is the thing a stray thumbnail column would take away. A pixel count
  // would also move every time the row's own padding or border did.
  verifyMetaReads = (meta: string) =>
    this.step(`verifyMetaReads ${meta}`, () =>
      expect(this.get(libraryOverviewCardTestIds.meta)).toHaveText(meta),
    );

  verifyTitleSpansTheRow = () =>
    this.step("verifyTitleSpansTheRow", async () => {
      const title = (await this.get(libraryOverviewCardTestIds.titleLink).boundingBox())!;
      const row = (await this.get(libraryOverviewCardTestIds.row).boundingBox())!;
      expect(Math.round(title.width)).toBe(Math.round(row.width));
    });

  verifyHasThumbnail = () => this.expectToBeVisible(overviewThumbnailTestIds.image);
  verifyHasNoThumbnail = () => this.expectNotToBeVisible(overviewThumbnailTestIds.image);
}
