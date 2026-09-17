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
      expect(
        this.get(readAlongNoteTestIds.activeLine).getByTestId(readAlongNoteTestIds.lineText),
      ).toHaveText(text),
    );

  verifyBulletedLinesRead = (texts: string[]) =>
    this.step(`verifyBulletedLinesRead ${texts.join(", ")}`, () =>
      expect(
        this.get(readAlongNoteTestIds.line)
          .or(this.get(readAlongNoteTestIds.activeLine))
          .filter({ has: this.page.getByTestId(readAlongNoteTestIds.bullet) })
          .getByTestId(readAlongNoteTestIds.lineText),
      ).toHaveText(texts),
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

  // The player bar's circle is the row's circle: the control keeps its shape between a row
  // and the note that row opens, which is the whole reason the two sizes are one number.
  verifyFavouriteMatchesTheRow = (size: number) =>
    this.step(`verifyFavouriteMatchesTheRow ${size}`, async () => {
      const box = (await this.get(readerPlayerBarTestIds.favouriteButton).boundingBox())!;
      expect(Math.round(box.width)).toBe(size);
      expect(Math.round(box.height)).toBe(size);
    });
  clickMarkRead = () => this.step("clickMarkRead", () => this.click(readerMastheadTestIds.readButton));

  clickSection = (section: string) =>
    this.step(`clickSection ${section}`, () => this.click(readerRailTestIds.section(section)));

  clickTab = (tab: string) => this.step(`clickTab ${tab}`, () => this.click(readerTabsTestIds.tab(tab)));

  // The indicator's position is measured off the laid-out buttons, so this is what fails
  // if that measurement ever stops happening — the three labels are different widths and
  // nothing else would notice.
  verifyTabIndicatorSitsUnder = (tab: string) =>
    this.step(`verifyTabIndicatorSitsUnder ${tab}`, () =>
      expect(async () => {
        const button = (await this.get(readerTabsTestIds.tab(tab)).boundingBox())!;
        const indicator = (await this.get(readerTabsTestIds.indicator).boundingBox())!;
        expect(Math.round(indicator.x)).toBe(Math.round(button.x));
        expect(Math.round(indicator.width)).toBe(Math.round(button.width));
      }).toPass({ timeout: 2_000 }),
    );

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

  verifyTranscriptLinesRead = (lines: string[]) =>
    this.step(`verifyTranscriptLinesRead ${lines.join(", ")}`, () =>
      expect(this.get(transcriptPanelTestIds.rowText)).toHaveText(lines),
    );

  verifyTranscriptTimesRead = (times: string[]) =>
    this.step(`verifyTranscriptTimesRead ${times.join(", ")}`, () =>
      expect(this.get(transcriptPanelTestIds.rowTime)).toHaveText(times),
    );

  verifyTranscriptLineLinksToVideoAt = (line: string, href: string) =>
    this.step(`verifyTranscriptLineLinksToVideoAt ${line}`, () =>
      expect(this.get(transcriptPanelTestIds.row).filter({ hasText: line })).toHaveAttribute("href", href),
    );

  verifyShowsNoStoredTranscript = () => this.expectToBeVisible(transcriptPanelTestIds.emptyNote);
  verifyShowsTranscriptSkeleton = () => this.expectToBeVisible(transcriptPanelTestIds.skeleton);
  verifyShowsMachineTranscribedNote = () => this.expectToBeVisible(transcriptPanelTestIds.sourceNote);
  verifyShowsNoMachineTranscribedNote = () => this.expectNotToBeVisible(transcriptPanelTestIds.sourceNote);
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

  scrollTheNote = () =>
    this.step("scrollTheNote", async () => {
      await this.page.mouse.wheel(0, 900);
      await expect(async () => {
        expect(await this.page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
      }).toPass({ timeout: 2_000 });
    });

  verifyRailRestsUnderTheTabs = () =>
    this.step("verifyRailRestsUnderTheTabs", () =>
      expect(async () => {
        const tabs = (await this.get(readerTabsTestIds.root).boundingBox())!;
        const rail = (await this.get(readerRailTestIds.sticky).boundingBox())!;
        expect(Math.round(rail.y)).toBe(Math.round(tabs.y + tabs.height));
      }).toPass({ timeout: 2_000 }),
    );

  // The reader's foot is the player bar, not the window, so that is what the rail's divider
  // has to reach rather than the viewport edge.
  verifyRailDividerMeetsThePlayerBar = () =>
    this.step("verifyRailDividerMeetsThePlayerBar", async () => {
      const rail = (await this.get(readerRailTestIds.root).boundingBox())!;
      const player = (await this.get(readerPlayerBarTestIds.root).boundingBox())!;
      expect(Math.round(rail.y + rail.height)).toBeGreaterThanOrEqual(Math.round(player.y));
    });

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
