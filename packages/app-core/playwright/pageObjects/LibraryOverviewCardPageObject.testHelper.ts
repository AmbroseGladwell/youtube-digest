import { expect } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import { libraryOverviewCardTestIds } from "../../src/features/library/components/LibraryOverviewCard/LibraryOverviewCardTestIds.js";
import { overviewThumbnailTestIds } from "../../src/components/shared/OverviewThumbnail/OverviewThumbnailTestIds.js";
import { kindChipTestIds } from "../../src/components/shared/KindChip/KindChipTestIds.js";
import { savedChipTestIds } from "../../src/features/timeSaved/components/SavedChip/SavedChipTestIds.js";
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
    this.step(`verifyTitle ${title}`, () => expect(this.get(libraryOverviewCardTestIds.titleLink)).toContainText(title));

  openReader = (): Promise<ReaderPageObject> =>
    this.step("openReader", async () => {
      await this.click(libraryOverviewCardTestIds.titleLink);
      return new ReaderPageObject(this.testContext).verifyIsShown();
    });

  openTheMomentSaid = (): Promise<ReaderPageObject> =>
    this.step("openTheMomentSaid", async () => {
      await this.click(libraryOverviewCardTestIds.saidLink);
      return new ReaderPageObject(this.testContext).verifyIsShown();
    });

  clickListen = () => this.step("clickListen", () => this.click(libraryOverviewCardTestIds.listenButton));

  verifyListenReads = (label: string) =>
    this.step(`verifyListenReads ${label}`, () => expect(this.get(libraryOverviewCardTestIds.listenButton)).toHaveText(label));

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

  verifySavedChipSays = (text: string) =>
    this.step(`verifySavedChipSays ${text}`, () => expect(this.get(savedChipTestIds.root)).toContainText(text));

  verifySavedChipFigureReads = (text: string) =>
    this.step(`verifySavedChipFigureReads ${text}`, () => expect(this.get(savedChipTestIds.figure)).toHaveText(text));

  verifyNoSavedChip = () => this.step("verifyNoSavedChip", () => this.expectNotToBeVisible(savedChipTestIds.root));

  verifyIsFavourited = (isFavourited: boolean) =>
    this.step(`verifyIsFavourited ${isFavourited}`, () =>
      expect(this.get(libraryOverviewCardTestIds.favouriteButton)).toHaveAttribute("aria-pressed", String(isFavourited)),
    );

  verifyIsRead = (isRead: boolean) =>
    this.step(`verifyIsRead ${isRead}`, () =>
      expect(this.get(libraryOverviewCardTestIds.readButton)).toHaveAttribute("aria-pressed", String(isRead)),
    );

  verifyActionsAreIconsOnTheTimingLine = () =>
    this.step("verifyActionsAreIconsOnTheTimingLine", async () => {
      const timing = (await this.get(libraryOverviewCardTestIds.meta).boundingBox())!;
      const timingMiddle = timing.y + timing.height / 2;
      for (const testId of this.actionTestIds) {
        const box = (await this.get(testId).boundingBox())!;
        expect([Math.round(box.width), Math.round(box.height)]).toEqual([40, 40]);
        expect(box.x).toBeGreaterThan(timing.x + timing.width);
        expect(Math.abs(box.y + box.height / 2 - timingMiddle)).toBeLessThanOrEqual(2);
      }
    });

  verifyActionsAreNamed = (favourite: string, read: string, listen: string) =>
    this.step(`verifyActionsAreNamed ${favourite} / ${read} / ${listen}`, async () => {
      await expect(this.get(libraryOverviewCardTestIds.favouriteButton)).toHaveAccessibleName(favourite);
      await expect(this.get(libraryOverviewCardTestIds.readButton)).toHaveAccessibleName(read);
      await expect(this.get(libraryOverviewCardTestIds.listenButton)).toHaveAccessibleName(listen);
    });

  verifyReadButtonShowsItsNameOnFocus = (name: string) =>
    this.step(`verifyReadButtonShowsItsNameOnFocus ${name}`, async () => {
      const button = this.get(libraryOverviewCardTestIds.readButton);
      await button.focus();
      await expect(button.locator("[aria-hidden='true']", { hasText: name }).last()).toBeVisible();
    });

  height = async (): Promise<number> => Math.round((await this.card.boundingBox())!.height);

  verifySavedChipHoldsTheTimingLinesPlace = (heightBefore: number) =>
    this.step("verifySavedChipHoldsTheTimingLinesPlace", async () => {
      await expect(this.get(savedChipTestIds.root)).toBeVisible();
      await expect(this.get(libraryOverviewCardTestIds.meta)).toBeHidden();
      await expect(async () => {
        const chip = (await this.get(savedChipTestIds.root).boundingBox())!;
        const title = (await this.get(libraryOverviewCardTestIds.titleLink).boundingBox())!;
        expect(Math.round(chip.x)).toBe(Math.round(title.x));
      }).toPass();
      expect(await this.height()).toBe(heightBefore);
    });

  private readonly actionTestIds = [
    libraryOverviewCardTestIds.favouriteButton,
    libraryOverviewCardTestIds.readButton,
    libraryOverviewCardTestIds.listenButton,
  ];

  // Read off the laid-out element: what matters is what is painted, not which rule painted it.
  private chrome = () =>
    this.card.evaluate((row) => {
      const style = getComputedStyle(row);
      return {
        shadow: style.boxShadow,
        background: style.backgroundColor,
        transform: style.transform,
      };
    });

  private static readonly TRANSPARENT = "rgba(0, 0, 0, 0)";

  verifyRestsOnItsTile = () =>
    this.step("verifyRestsOnItsTile", () =>
      expect(async () => {
        const { shadow, background, transform } = await this.chrome();
        expect(shadow).not.toBe("none");
        expect(background).not.toBe(LibraryOverviewCardPageObject.TRANSPARENT);
        expect(transform).toBe("none");
      }).toPass({ timeout: 2_000 }),
    );

  restingShadow = async (): Promise<string> => (await this.chrome()).shadow;

  verifyLiftsAbove = (restingShadow: string) =>
    this.step("verifyLiftsAbove", () =>
      expect(async () => {
        const { shadow, transform } = await this.chrome();
        expect(shadow).not.toBe("none");
        expect(shadow).not.toBe(restingShadow);
        expect(transform).toBe("none");
      }).toPass({ timeout: 2_000 }),
    );

  verifyRestsWith = (restingShadow: string) =>
    this.step("verifyRestsWith", () =>
      expect(async () => {
        expect((await this.chrome()).shadow).toBe(restingShadow);
      }).toPass({ timeout: 2_000 }),
    );

  hoverTitle = () => this.step("hoverTitle", () => this.get(libraryOverviewCardTestIds.titleLink).hover());

  focusFirstControl = () => this.step("focusFirstControl", () => this.get(libraryOverviewCardTestIds.favouriteButton).focus());

  titleLeftEdge = async () => Math.round((await this.get(libraryOverviewCardTestIds.titleLink).boundingBox())!.x);

  // Against the row, not a pixel count, which would move with the row's own padding or border.
  verifyKindChipReads = (kind: string) =>
    this.step(`verifyKindChipReads ${kind}`, () => expect(this.get(kindChipTestIds.root)).toHaveText(kind));

  verifyHasNoKindChip = () => this.step("verifyHasNoKindChip", () => expect(this.get(kindChipTestIds.root)).toHaveCount(0));

  verifyMetaEndsWith = (end: string) =>
    this.step(`verifyMetaEndsWith ${end}`, () => expect(this.get(libraryOverviewCardTestIds.meta)).toHaveText(new RegExp(`${end}$`)));

  verifyMetaReads = (meta: string) =>
    this.step(`verifyMetaReads ${meta}`, () => expect(this.get(libraryOverviewCardTestIds.meta)).toHaveText(meta));

  // Sized separately and the heart's outline derived from its ink, so the two drifted apart.
  verifyActionsAgreeOnHeightAndEdge = () =>
    this.step("verifyActionsAgreeOnHeightAndEdge", async () => {
      const read = this.get(libraryOverviewCardTestIds.readButton);
      const favourite = this.get(libraryOverviewCardTestIds.favouriteButton);

      const [readBox, favouriteBox] = [await read.boundingBox(), await favourite.boundingBox()];
      expect(Math.round(favouriteBox!.height)).toBe(Math.round(readBox!.height));

      const edge = (locator: typeof read) => locator.evaluate((el) => getComputedStyle(el).borderTopColor);
      expect(await edge(favourite)).toBe(await edge(read));
    });

  verifyTitleSpansTheRow = () =>
    this.step("verifyTitleSpansTheRow", async () => {
      const title = (await this.get(libraryOverviewCardTestIds.titleLink).boundingBox())!;
      const row = (await this.get(libraryOverviewCardTestIds.row).boundingBox())!;
      expect(Math.round(title.width)).toBe(Math.round(row.width));
    });

  verifyHasThumbnail = () => this.expectToBeVisible(overviewThumbnailTestIds.image);

  verifyImageSpansTheTile = () =>
    this.step("verifyImageSpansTheTile", async () => {
      const image = (await this.get(overviewThumbnailTestIds.link).boundingBox())!;
      const tile = (await this.card.boundingBox())!;
      expect(Math.round(image.width)).toBe(Math.round(tile.width));
      expect(Math.round(image.x)).toBe(Math.round(tile.x));
      expect(Math.abs(image.height - image.width / 2)).toBeLessThanOrEqual(1);
    });

  verifyImageWidth = (width: number) =>
    this.step(`verifyImageWidth ${width}`, async () => {
      const image = (await this.get(overviewThumbnailTestIds.link).boundingBox())!;
      expect(Math.round(image.width)).toBe(width);
    });

  verifyLengthBadgeReads = (text: string | null) =>
    this.step(`verifyLengthBadgeReads ${text}`, () =>
      text === null
        ? expect(this.get(overviewThumbnailTestIds.badge)).toHaveCount(0)
        : expect(this.get(overviewThumbnailTestIds.badge)).toHaveText(text),
    );

  verifyLengthShownInTheMeta = (shown: boolean) =>
    this.step(`verifyLengthShownInTheMeta ${shown}`, async () => {
      const length = (await this.get(libraryOverviewCardTestIds.metaLength).boundingBox())!;
      expect(length.width > 1).toBe(shown);
    });
  verifyHasNoThumbnail = () => this.expectNotToBeVisible(overviewThumbnailTestIds.image);

  verifyAddedByReads = (text: string | null) =>
    this.step(`verifyAddedByReads ${text}`, () =>
      text === null
        ? this.expectNotToBeVisible(libraryOverviewCardTestIds.addedBy)
        : expect(this.get(libraryOverviewCardTestIds.addedBy)).toHaveText(text),
    );

  clickRemoveFromProject = () => this.step("clickRemoveFromProject", () => this.click(libraryOverviewCardTestIds.removeFromProjectButton));
}
