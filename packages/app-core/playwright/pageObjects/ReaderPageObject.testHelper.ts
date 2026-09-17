import { expect } from "@playwright/experimental-ct-react";
import { readerPageTestIds } from "../../src/features/reader/ReaderPage/ReaderPageTestIds.js";
import { readAlongNoteTestIds } from "../../src/features/reader/components/ReadAlongNote/ReadAlongNoteTestIds.js";
import { readerMastheadTestIds } from "../../src/features/reader/components/ReaderMasthead/ReaderMastheadTestIds.js";
import { readerPlayerBarTestIds } from "../../src/features/reader/components/ReaderPlayerBar/ReaderPlayerBarTestIds.js";
import { readerRailTestIds } from "../../src/features/reader/components/ReaderRail/ReaderRailTestIds.js";
import { readerTabsTestIds } from "../../src/features/reader/components/ReaderTabs/ReaderTabsTestIds.js";
import { chaptersPanelTestIds } from "../../src/features/reader/components/ChaptersPanel/ChaptersPanelTestIds.js";
import { transcriptPanelTestIds } from "../../src/features/reader/components/TranscriptPanel/TranscriptPanelTestIds.js";
import { appShellTestIds } from "../../src/shell/AppShell/AppShellTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { LibraryPageObject } from "./LibraryPageObject.testHelper.js";

export class ReaderPageObject extends PageObject {
  verifyIsShown = (): Promise<ReaderPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(readerPageTestIds.root);
      return this;
    });

  verifyTitle = (title: string) =>
    this.step(`verifyTitle ${title}`, () =>
      expect(this.get(readerMastheadTestIds.title)).toHaveText(title),
    );

  verifyMetaReads = (meta: string) =>
    this.step(`verifyMetaReads ${meta}`, () => expect(this.get(readerMastheadTestIds.meta)).toHaveText(meta));

  verifyPosition = (position: string) =>
    this.step(`verifyPosition ${position}`, () =>
      expect(this.get(readerMastheadTestIds.position)).toHaveText(position),
    );

  verifyNotFound = () => this.expectToBeVisible(readerPageTestIds.notFound);

  verifyActiveLineReads = (text: string) =>
    this.step(`verifyActiveLineReads ${text}`, () =>
      expect(this.get(readAlongNoteTestIds.activeLine)).toHaveText(text),
    );

  clickLineWithText = (text: string) =>
    this.step(`clickLineWithText ${text}`, () =>
      this.get(readAlongNoteTestIds.line).filter({ hasText: text }).first().click(),
    );

  clickNextLine = () => this.step("clickNextLine", () => this.click(readerPlayerBarTestIds.nextButton));
  clickPreviousLine = () =>
    this.step("clickPreviousLine", () => this.click(readerPlayerBarTestIds.previousButton));
  clickRate = () => this.step("clickRate", () => this.click(readerPlayerBarTestIds.rateButton));
  clickFavourite = () => this.step("clickFavourite", () => this.click(readerPlayerBarTestIds.favouriteButton));
  clickMarkRead = () => this.step("clickMarkRead", () => this.click(readerMastheadTestIds.readButton));

  clickSection = (section: string) =>
    this.step(`clickSection ${section}`, () => this.click(readerRailTestIds.section(section)));

  clickTab = (tab: string) => this.step(`clickTab ${tab}`, () => this.click(readerTabsTestIds.tab(tab)));

  clickNextOverview = () =>
    this.step("clickNextOverview", () => this.click(readerMastheadTestIds.nextLink));

  verifyRateReads = (rate: string) =>
    this.step(`verifyRateReads ${rate}`, () =>
      expect(this.get(readerPlayerBarTestIds.rateButton)).toHaveText(rate),
    );

  verifyNowReading = (section: string) =>
    this.step(`verifyNowReading ${section}`, () =>
      expect(this.get(readerPlayerBarTestIds.nowReading)).toHaveText(`Now reading · ${section}`),
    );

  verifyIsFavourited = (isFavourited: boolean) =>
    this.step(`verifyIsFavourited ${isFavourited}`, () =>
      expect(this.get(readerPlayerBarTestIds.favouriteButton)).toHaveAttribute(
        "aria-pressed",
        String(isFavourited),
      ),
    );

  verifyIsRead = (isRead: boolean) =>
    this.step(`verifyIsRead ${isRead}`, () =>
      expect(this.get(readerMastheadTestIds.readButton)).toHaveAttribute("aria-pressed", String(isRead)),
    );

  verifyShowsTranscriptPlaceholder = () =>
    this.expectToBeVisible(transcriptPanelTestIds.placeholderNote);
  verifyShowsChaptersPlaceholder = () => this.expectToBeVisible(chaptersPanelTestIds.placeholderNote);
  verifyShowsOverviewPanel = () => this.expectToBeVisible(readerPageTestIds.overviewPanel);

  scrollDown = (pixels: number) =>
    this.step(`scrollDown ${pixels}`, async () => {
      await this.page.mouse.wheel(0, pixels);
      await this.page.waitForTimeout(300);
    });

  verifyTabsRestOnTheMasthead = () =>
    this.step("verifyTabsRestOnTheMasthead", () =>
      expect(async () => {
        const masthead = (await this.page.getByTestId(appShellTestIds.masthead).boundingBox())!;
        const tabs = (await this.get(readerTabsTestIds.root).boundingBox())!;
        expect(Math.round(tabs.y)).toBe(Math.round(masthead.y + masthead.height));
      }).toPass({ timeout: 2_000 }),
    );

  verifyPageDoesNotScrollSideways = () =>
    this.step("verifyPageDoesNotScrollSideways", async () => {
      const overflow = await this.page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

  clickBackToLibrary = (): Promise<LibraryPageObject> =>
    this.step("clickBackToLibrary", async () => {
      await this.click(readerMastheadTestIds.backLink);
      return new LibraryPageObject(this.testContext).verifyIsShown();
    });
}
