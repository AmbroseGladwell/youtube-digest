import { expect } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import { readerPageTestIds } from "../../src/features/reader/ReaderPage/ReaderPageTestIds.js";
import { captureReasonLineTestIds } from "../../src/features/reader/components/CaptureReasonLine/CaptureReasonLineTestIds.js";
import { readAlongNoteTestIds } from "../../src/features/reader/components/ReadAlongNote/ReadAlongNoteTestIds.js";
import { readerMastheadTestIds } from "../../src/features/reader/components/ReaderMasthead/ReaderMastheadTestIds.js";
import { readerPlayerBarTestIds } from "../../src/features/reader/components/ReaderPlayerBar/ReaderPlayerBarTestIds.js";
import { readerRailTestIds } from "../../src/features/reader/components/ReaderRail/ReaderRailTestIds.js";
import { readerTabsTestIds } from "../../src/features/reader/components/ReaderTabs/ReaderTabsTestIds.js";
import { chaptersPanelTestIds } from "../../src/features/reader/components/ChaptersPanel/ChaptersPanelTestIds.js";
import { topicLineTestIds } from "../../src/features/reader/components/TopicLine/TopicLineTestIds.js";
import { overviewActionsMenuTestIds } from "../../src/features/reader/components/OverviewActionsMenu/OverviewActionsMenuTestIds.js";
import { TopicPickerPageObject } from "./TopicPickerPageObject.testHelper.js";
import { transcriptPanelTestIds } from "../../src/features/reader/components/TranscriptPanel/TranscriptPanelTestIds.js";
import { watchAnywayJumpTestIds } from "../../src/features/reader/components/WatchAnywayJump/WatchAnywayJumpTestIds.js";
import { plusPromptTestIds } from "../../src/features/plus/components/PlusPrompt/PlusPromptTestIds.js";
import { plusSavedLocallyNoteTestIds } from "../../src/features/plus/components/PlusSavedLocallyNote/PlusSavedLocallyNoteTestIds.js";
import { appShellTestIds } from "../../src/shell/AppShell/AppShellTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { LibraryPageObject } from "./LibraryPageObject.testHelper.js";
import { SettingsPageObject } from "./SettingsPageObject.testHelper.js";

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

  verifyPublishedReads = (published: string) =>
    this.step(`verifyPublishedReads ${published}`, () =>
      expect(this.get(readerMastheadTestIds.published)).toHaveText(published),
    );

  verifyShowsNoPublished = () =>
    this.step("verifyShowsNoPublished", () =>
      this.expectNotToBeVisible(readerMastheadTestIds.published),
    );

  verifyMetaReads = (meta: string) =>
    this.step(`verifyMetaReads ${meta}`, () =>
      expect(this.get(readerMastheadTestIds.meta)).toHaveText(meta),
    );

  verifyPosition = (position: string) =>
    this.step(`verifyPosition ${position}`, () =>
      expect(this.get(readerMastheadTestIds.position)).toHaveText(position),
    );

  verifyNotFound = () => this.expectToBeVisible(readerPageTestIds.notFound);

  get topicPicker(): TopicPickerPageObject {
    return new TopicPickerPageObject(this.testContext);
  }

  verifyFiledUnder = (topicNames: string[]) =>
    this.step(`verifyFiledUnder ${topicNames.join(", ")}`, () =>
      expect(this.get(topicLineTestIds.chip)).toHaveText(
        topicNames.map((name) => new RegExp(name)),
      ),
    );

  verifyIsFiledNowhere = () =>
    this.step("verifyIsFiledNowhere", () => this.expectToHaveCount(topicLineTestIds.chip, 0));

  openActionsMenu = () =>
    this.step("openActionsMenu", () => this.click(overviewActionsMenuTestIds.trigger));

  verifyChannelReads = (channel: string) =>
    this.step(`verifyChannelReads ${channel}`, () =>
      expect(this.get(readerMastheadTestIds.channel)).toHaveText(channel),
    );

  // The head is four facts wide on the desktop reader and two in the panel, so what it
  // leaves out is as much the behaviour as what it prints.
  verifyMastheadOmits = (pattern: RegExp) =>
    this.step(`verifyMastheadOmits ${pattern.source}`, () =>
      expect(this.get(readerMastheadTestIds.root)).not.toHaveText(pattern),
    );

  verifyMastheadMentions = (pattern: RegExp) =>
    this.step(`verifyMastheadMentions ${pattern.source}`, () =>
      expect(this.get(readerMastheadTestIds.root)).toHaveText(pattern),
    );

  // Same line, measured rather than assumed: the verdict and the warnings share the
  // topics' row rather than stacking into a second band of small caps. Overlap rather
  // than a shared top edge — a chip carries a border and padding that plain text on the
  // same line does not, so their boxes start a couple of pixels apart.
  verifyJudgementSharesTheTopicLine = () =>
    this.step("verifyJudgementSharesTheTopicLine", () =>
      expect(async () => {
        const rowOf = async (locator: Locator) => {
          const box = (await locator.boundingBox())!;
          return { top: box.y, bottom: box.y + box.height };
        };
        const chip = await rowOf(this.get(topicLineTestIds.chip).first());
        const novelty = await rowOf(this.page.getByText("Novel", { exact: true }));
        const dubious = await rowOf(this.page.getByText(/Dubious claim/));

        for (const beside of [novelty, dubious]) {
          expect(beside.top).toBeLessThan(chip.bottom);
          expect(chip.top).toBeLessThan(beside.bottom);
        }
      }).toPass({ timeout: 2_000 }),
    );

  // Both halves of the bug this covers: a menu anchored to the wrong edge leaves the
  // window, and one trapped in the sticky head's stacking context is painted over by
  // the tab strip.
  verifyActionsMenuFitsAndIsOnTop = () =>
    this.step("verifyActionsMenuFitsAndIsOnTop", () =>
      expect(async () => {
        const menu = this.get(overviewActionsMenuTestIds.menu);
        const box = (await menu.boundingBox())!;
        const viewport = this.page.viewportSize()!;

        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(Math.round(box.x + box.width)).toBeLessThanOrEqual(viewport.width);

        const unobstructed = await menu.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const atCentre = document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          );
          return atCentre !== null && element.contains(atCentre);
        });
        expect(unobstructed).toBe(true);
      }).toPass({ timeout: 2_000 }),
    );

  verifyActionsMenuIsShown = (shown: boolean) =>
    this.step(`verifyActionsMenuIsShown ${shown}`, () =>
      shown
        ? this.expectToBeVisible(overviewActionsMenuTestIds.menu)
        : this.expectNotToBeVisible(overviewActionsMenuTestIds.menu),
    );

  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));

  // Somewhere that is nobody's popover: the note's own title.
  clickAwayFromAnyPopover = () =>
    this.step("clickAwayFromAnyPopover", () => this.click(readerMastheadTestIds.title));

  verifyEditTopicsCountReads = (count: string) =>
    this.step(`verifyEditTopicsCountReads ${count}`, () =>
      expect(this.get(overviewActionsMenuTestIds.topicCount)).toHaveText(count),
    );

  clickEditTopics = (): Promise<TopicPickerPageObject> =>
    this.step("clickEditTopics", async () => {
      await this.click(overviewActionsMenuTestIds.editTopicsItem);
      return this.topicPicker.verifyIsShown();
    });

  editTopics = (): Promise<TopicPickerPageObject> =>
    this.step("editTopics", async () => {
      await this.openActionsMenu();
      return this.clickEditTopics();
    });

  removeTopic = (name: string) =>
    this.step(`removeTopic ${name}`, () => this.click(topicLineTestIds.removeChip(name)));

  clickAddTopic = () => this.step("clickAddTopic", () => this.click(topicLineTestIds.addButton));

  verifyTopicsAreEditable = (editable: boolean) =>
    this.step(`verifyTopicsAreEditable ${editable}`, () =>
      editable
        ? this.expectToBeVisible(topicLineTestIds.addButton)
        : this.expectNotToBeVisible(topicLineTestIds.addButton),
    );

  verifyReasonReads = (reason: string) =>
    this.step(`verifyReasonReads ${reason}`, () =>
      expect(this.get(captureReasonLineTestIds.reason)).toHaveText(reason),
    );

  verifyHasNoReason = () =>
    this.step("verifyHasNoReason", () => this.expectNotToBeVisible(captureReasonLineTestIds.root));

  verifyReasonMenuItemReads = (label: string) =>
    this.step(`verifyReasonMenuItemReads ${label}`, () =>
      expect(this.get(overviewActionsMenuTestIds.reasonItem)).toHaveText(label),
    );

  clickReasonMenuItem = () =>
    this.step("clickReasonMenuItem", () => this.click(overviewActionsMenuTestIds.reasonItem));

  editReason = () =>
    this.step("editReason", async () => {
      await this.openActionsMenu();
      await this.clickReasonMenuItem();
      await this.verifyReasonEditorIsShown(true);
    });

  verifyReasonEditorIsShown = (shown: boolean) =>
    this.step(`verifyReasonEditorIsShown ${shown}`, () =>
      shown
        ? this.expectToBeVisible(captureReasonLineTestIds.editor)
        : this.expectNotToBeVisible(captureReasonLineTestIds.editor),
    );

  verifyReasonFieldIsFocused = () =>
    this.step("verifyReasonFieldIsFocused", () =>
      expect(this.get(captureReasonLineTestIds.input)).toBeFocused(),
    );

  verifyReasonFieldHolds = (text: string) =>
    this.step(`verifyReasonFieldHolds ${text}`, () =>
      expect(this.get(captureReasonLineTestIds.input)).toHaveValue(text),
    );

  fillReason = (text: string) =>
    this.step(`fillReason ${text}`, () => this.get(captureReasonLineTestIds.input).fill(text));

  pressEnterInReason = () =>
    this.step("pressEnterInReason", () => this.get(captureReasonLineTestIds.input).press("Enter"));

  clickSaveReason = () =>
    this.step("clickSaveReason", () => this.click(captureReasonLineTestIds.saveButton));

  clickCancelReason = () =>
    this.step("clickCancelReason", () => this.click(captureReasonLineTestIds.cancelButton));

  clickRemoveReason = () =>
    this.step("clickRemoveReason", () => this.click(captureReasonLineTestIds.removeButton));

  verifyOffersToRemoveReason = (offered: boolean) =>
    this.step(`verifyOffersToRemoveReason ${offered}`, () =>
      offered
        ? this.expectToBeVisible(captureReasonLineTestIds.removeButton)
        : this.expectNotToBeVisible(captureReasonLineTestIds.removeButton),
    );

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

  clickNextLine = () =>
    this.step("clickNextLine", () => this.click(readerPlayerBarTestIds.nextButton));
  clickPlayPause = () =>
    this.step("clickPlayPause", () => this.click(readerPlayerBarTestIds.playButton));
  clickPreviousLine = () =>
    this.step("clickPreviousLine", () => this.click(readerPlayerBarTestIds.previousButton));
  clickRate = () => this.step("clickRate", () => this.click(readerPlayerBarTestIds.rateButton));
  clickFavourite = () =>
    this.step("clickFavourite", () => this.click(readerPlayerBarTestIds.favouriteButton));

  // The player bar's circle is the row's circle: the control keeps its shape between a row
  // and the note that row opens, which is the whole reason the two sizes are one number.
  verifyFavouriteMatchesTheRow = (size: number) =>
    this.step(`verifyFavouriteMatchesTheRow ${size}`, async () => {
      const box = (await this.get(readerPlayerBarTestIds.favouriteButton).boundingBox())!;
      expect(Math.round(box.width)).toBe(size);
      expect(Math.round(box.height)).toBe(size);
    });
  clickMarkRead = () =>
    this.step("clickMarkRead", () => this.click(readerMastheadTestIds.readButton));

  clickSection = (section: string) =>
    this.step(`clickSection ${section}`, () => this.click(readerRailTestIds.section(section)));

  clickTab = (tab: string) =>
    this.step(`clickTab ${tab}`, () => this.click(readerTabsTestIds.tab(tab)));

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
      expect(this.get(readerMastheadTestIds.readButton)).toHaveAttribute(
        "aria-pressed",
        String(isRead),
      ),
    );

  verifyTranscriptBlocksRead = (blocks: string[]) =>
    this.step(`verifyTranscriptBlocksRead ${blocks.join(" / ")}`, () =>
      expect(this.get(transcriptPanelTestIds.rowText)).toHaveText(blocks),
    );

  verifyTranscriptBlockTimesRead = (times: string[]) =>
    this.step(`verifyTranscriptBlockTimesRead ${times.join(", ")}`, () =>
      expect(this.get(transcriptPanelTestIds.rowTime)).toHaveText(times),
    );

  clickTranscriptTime = (time: string) =>
    this.step(`clickTranscriptTime ${time}`, () =>
      this.get(transcriptPanelTestIds.rowTime)
        .filter({ hasText: new RegExp(`^${time}$`) })
        .click(),
    );

  verifyTranscriptTimesSeek = (seekable: boolean) =>
    this.step(`verifyTranscriptTimesSeek ${seekable}`, async () => {
      const seekControls = this.page.getByRole("button", { name: /^Play the video from/ });
      await (seekable
        ? expect(seekControls.first()).toBeVisible()
        : expect(seekControls).toHaveCount(0));
    });

  verifyTranscriptBlockCountIs = (count: number) =>
    this.step(`verifyTranscriptBlockCountIs ${count}`, () =>
      this.expectToHaveCount(transcriptPanelTestIds.row, count),
    );

  verifyTranscriptSpeakerMarkCountIs = (count: number) =>
    this.step(`verifyTranscriptSpeakerMarkCountIs ${count}`, () =>
      this.expectToHaveCount(transcriptPanelTestIds.speakerMark, count),
    );

  verifyTranscriptToolsAreShown = (shown: boolean) =>
    this.step(`verifyTranscriptToolsAreShown ${shown}`, () =>
      shown
        ? this.expectToBeVisible(transcriptPanelTestIds.tools)
        : this.expectNotToBeVisible(transcriptPanelTestIds.tools),
    );

  clickCopyTranscript = () =>
    this.step("clickCopyTranscript", () => this.click(transcriptPanelTestIds.copyButton));

  verifyCopyButtonReads = (label: string) =>
    this.step(`verifyCopyButtonReads ${label}`, () =>
      expect(this.get(transcriptPanelTestIds.copyButton)).toHaveText(label),
    );

  verifyTranscriptCannotBeCopied = () =>
    this.step("verifyTranscriptCannotBeCopied", () =>
      this.expectNotToBeVisible(transcriptPanelTestIds.copyButton),
    );

  searchTheTranscript = (query: string) =>
    this.step(`searchTheTranscript ${query}`, () =>
      this.get(transcriptPanelTestIds.searchInput).fill(query),
    );

  verifyMatchCountReads = (count: string) =>
    this.step(`verifyMatchCountReads ${count}`, () =>
      expect(this.get(transcriptPanelTestIds.matchCount)).toHaveText(count),
    );

  verifyMatchCountIsHidden = () =>
    this.step("verifyMatchCountIsHidden", () =>
      this.expectNotToBeVisible(transcriptPanelTestIds.matchCount),
    );

  verifyHighlightedMatchCountIs = (count: number) =>
    this.step(`verifyHighlightedMatchCountIs ${count}`, () =>
      this.expectToHaveCount(transcriptPanelTestIds.match, count),
    );

  verifyCurrentMatchReads = (text: string) =>
    this.step(`verifyCurrentMatchReads ${text}`, () =>
      expect(
        this.get(transcriptPanelTestIds.match).and(this.page.locator('[data-current="true"]')),
      ).toHaveText(text),
    );

  clickNextMatch = () =>
    this.step("clickNextMatch", () => this.click(transcriptPanelTestIds.nextMatchButton));

  clickPreviousMatch = () =>
    this.step("clickPreviousMatch", () => this.click(transcriptPanelTestIds.previousMatchButton));

  clickExportTranscript = () =>
    this.step("clickExportTranscript", () => this.click(transcriptPanelTestIds.exportButton));

  verifyIsFollowingTheVideo = (following: boolean) =>
    this.step(`verifyIsFollowingTheVideo ${following}`, () =>
      following
        ? this.expectToBeVisible(transcriptPanelTestIds.followingNote)
        : this.expectNotToBeVisible(transcriptPanelTestIds.followingNote),
    );

  verifyCurrentTranscriptBlockReads = (text: string | RegExp) =>
    this.step(`verifyCurrentTranscriptBlockReads ${String(text)}`, () =>
      expect(
        this.get(transcriptPanelTestIds.row)
          .and(this.page.locator('[data-current="true"]'))
          .getByTestId(transcriptPanelTestIds.rowText),
      ).toHaveText(text),
    );

  verifyNoTranscriptBlockIsCurrent = () =>
    this.step("verifyNoTranscriptBlockIsCurrent", () =>
      expect(
        this.get(transcriptPanelTestIds.row).and(this.page.locator('[data-current="true"]')),
      ).toHaveCount(0),
    );

  verifyOffersToFollowPlayback = (offered: boolean) =>
    this.step(`verifyOffersToFollowPlayback ${offered}`, () =>
      offered
        ? this.expectToBeVisible(transcriptPanelTestIds.followButton)
        : this.expectNotToBeVisible(transcriptPanelTestIds.followButton),
    );

  clickFollowPlayback = () =>
    this.step("clickFollowPlayback", () => this.click(transcriptPanelTestIds.followButton));

  verifyWatchAnywayRangeReads = (range: string) =>
    this.step(`verifyWatchAnywayRangeReads ${range}`, () =>
      expect(this.get(watchAnywayJumpTestIds.range)).toHaveText(range),
    );

  verifyHasNoWatchAnywayJump = () =>
    this.step("verifyHasNoWatchAnywayJump", () =>
      this.expectNotToBeVisible(watchAnywayJumpTestIds.root),
    );

  verifyOffersToSkipTheVideo = (offered: boolean) =>
    this.step(`verifyOffersToSkipTheVideo ${offered}`, () =>
      offered
        ? this.expectToBeVisible(watchAnywayJumpTestIds.skipButton)
        : this.expectNotToBeVisible(watchAnywayJumpTestIds.skipButton),
    );

  clickSkipToWatchAnyway = () =>
    this.step("clickSkipToWatchAnyway", () => this.click(watchAnywayJumpTestIds.skipButton));

  clickListen = () =>
    this.step("clickListen", () => this.click(readerMastheadTestIds.listenButton));

  verifyListenReads = (label: string) =>
    this.step(`verifyListenReads ${label}`, () =>
      expect(this.get(readerMastheadTestIds.listenButton)).toHaveText(label),
    );

  verifyPlayerIsDocked = (docked: boolean) =>
    this.step(`verifyPlayerIsDocked ${docked}`, () =>
      docked
        ? this.expectToBeVisible(readerPlayerBarTestIds.root)
        : this.expectNotToBeVisible(readerPlayerBarTestIds.root),
    );

  verifyPlusPromptIsShown = (shown: boolean) =>
    this.step(`verifyPlusPromptIsShown ${shown}`, () =>
      shown
        ? this.expectToBeVisible(plusPromptTestIds.root)
        : this.expectNotToBeVisible(plusPromptTestIds.root),
    );

  verifyPlusPromptReads = (pattern: RegExp) =>
    this.step(`verifyPlusPromptReads ${pattern.source}`, () =>
      expect(this.get(plusPromptTestIds.body)).toHaveText(pattern),
    );

  dismissPlusPrompt = () =>
    this.step("dismissPlusPrompt", () => this.click(plusPromptTestIds.notNowButton));

  openPlusFromPrompt = (): Promise<SettingsPageObject> =>
    this.step("openPlusFromPrompt", async () => {
      await this.click(plusPromptTestIds.seePlusLink);
      return new SettingsPageObject(this.testContext).verifyIsShown();
    });

  verifySavedLocallyNoteIsShown = (shown: boolean) =>
    this.step(`verifySavedLocallyNoteIsShown ${shown}`, () =>
      shown
        ? this.expectToBeVisible(plusSavedLocallyNoteTestIds.root)
        : this.expectNotToBeVisible(plusSavedLocallyNoteTestIds.root),
    );

  dismissSavedLocallyNote = () =>
    this.step("dismissSavedLocallyNote", () =>
      this.click(plusSavedLocallyNoteTestIds.dismissButton),
    );

  verifyMastheadIsPanelSized = () =>
    this.step("verifyMastheadIsPanelSized", async () => {
      await this.expectNotToBeVisible(readerMastheadTestIds.backLink);
      await this.expectNotToBeVisible(readerMastheadTestIds.breadcrumb);
      await this.expectNotToBeVisible(readerMastheadTestIds.readButton);
      await this.expectNotToBeVisible(readerRailTestIds.root);
    });

  verifyShowsNoStoredTranscript = () => this.expectToBeVisible(transcriptPanelTestIds.emptyNote);
  verifyShowsTranscriptSkeleton = () => this.expectToBeVisible(transcriptPanelTestIds.skeleton);
  // YouTube's own phrase for its speech-recognition track, not the developer's
  // (docs/features/transcript-storage.md).
  verifyShowsMachineTranscribedNote = () =>
    expect(this.get(transcriptPanelTestIds.sourceNote)).toHaveText("Auto-generated");
  verifyShowsNoMachineTranscribedNote = () =>
    this.expectNotToBeVisible(transcriptPanelTestIds.sourceNote);
  verifyShowsChaptersPanel = () => this.expectToBeVisible(chaptersPanelTestIds.root);

  verifyChaptersNoteReads = (pattern: RegExp) =>
    this.step(`verifyChaptersNoteReads ${pattern.source}`, () =>
      expect(this.get(chaptersPanelTestIds.note)).toHaveText(pattern),
    );

  verifyChapterCountReads = (count: string) =>
    this.step(`verifyChapterCountReads ${count}`, () =>
      expect(this.get(chaptersPanelTestIds.count)).toHaveText(count),
    );

  verifyChapterTitlesRead = (titles: string[]) =>
    this.step(`verifyChapterTitlesRead ${titles.join(" / ")}`, () =>
      expect(this.get(chaptersPanelTestIds.title)).toHaveText(titles),
    );

  verifyChapterSummariesRead = (summaries: string[]) =>
    this.step(`verifyChapterSummariesRead ${summaries.join(" / ")}`, () =>
      expect(this.get(chaptersPanelTestIds.summary)).toHaveText(summaries),
    );

  verifyChapterRangesRead = (ranges: string[]) =>
    this.step(`verifyChapterRangesRead ${ranges.join(", ")}`, () =>
      expect(this.get(chaptersPanelTestIds.range)).toHaveText(ranges),
    );

  private chapterRange = (range: string): Locator =>
    this.get(chaptersPanelTestIds.range).filter({ hasText: new RegExp(`^${range}$`) });

  clickChapterRange = (range: string) =>
    this.step(`clickChapterRange ${range}`, () => this.chapterRange(range).click());

  verifyChapterRangesSeek = (seekable: boolean) =>
    this.step(`verifyChapterRangesSeek ${seekable}`, async () => {
      const seekControls = this.page.getByRole("button", { name: /^Play the video from/ });
      await (seekable
        ? expect(seekControls).toHaveCount(await this.get(chaptersPanelTestIds.row).count())
        : expect(seekControls).toHaveCount(0));
    });

  // The wide reader's chapter is a link out, opened beside the note rather than over it.
  verifyChapterRangeLinksTo = (range: string, href: string) =>
    this.step(`verifyChapterRangeLinksTo ${range} ${href}`, async () => {
      const link = this.chapterRange(range);
      await expect(link).toHaveRole("link");
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
    });

  verifyChapterRangesLinkOut = (linked: boolean) =>
    this.step(`verifyChapterRangesLinkOut ${linked}`, async () => {
      const links = this.page.getByRole("link", { name: /^Open the video on YouTube at/ });
      await (linked
        ? expect(links).toHaveCount(await this.get(chaptersPanelTestIds.row).count())
        : expect(links).toHaveCount(0));
    });

  verifyCurrentChapterReads = (title: string) =>
    this.step(`verifyCurrentChapterReads ${title}`, () =>
      expect(
        this.get(chaptersPanelTestIds.row)
          .and(this.page.locator('[data-current="true"]'))
          .getByTestId(chaptersPanelTestIds.title),
      ).toHaveText(title),
    );

  verifyNoChapterIsCurrent = () =>
    this.step("verifyNoChapterIsCurrent", () =>
      expect(
        this.get(chaptersPanelTestIds.row).and(this.page.locator('[data-current="true"]')),
      ).toHaveCount(0),
    );

  clickChapterTranscript = (title: string) =>
    this.step(`clickChapterTranscript ${title}`, () =>
      this.get(chaptersPanelTestIds.row)
        .filter({ has: this.page.getByTestId(chaptersPanelTestIds.title).getByText(title, { exact: true }) })
        .getByTestId(chaptersPanelTestIds.transcriptButton)
        .click(),
    );

  verifyChaptersOfferTranscript = (offered: boolean) =>
    this.step(`verifyChaptersOfferTranscript ${offered}`, async () =>
      offered
        ? expect(this.get(chaptersPanelTestIds.transcriptButton)).toHaveCount(
            await this.get(chaptersPanelTestIds.row).count(),
          )
        : this.expectToHaveCount(chaptersPanelTestIds.transcriptButton, 0),
    );

  verifyActiveTabIs = (tab: string) =>
    this.step(`verifyActiveTabIs ${tab}`, () =>
      expect(this.get(readerTabsTestIds.tab(tab))).toHaveAttribute("aria-selected", "true"),
    );

  private targetTranscriptBlock = (): Locator =>
    this.get(transcriptPanelTestIds.row).and(this.page.locator('[data-target="true"]'));

  verifyTargetTranscriptBlockReads = (text: string | RegExp) =>
    this.step(`verifyTargetTranscriptBlockReads ${String(text)}`, async () => {
      await expect(
        this.targetTranscriptBlock().getByTestId(transcriptPanelTestIds.rowText),
      ).toHaveText(text);
      await expect(this.targetTranscriptBlock()).toBeInViewport();
    });

  verifyNoTranscriptBlockIsTargeted = () =>
    this.step("verifyNoTranscriptBlockIsTargeted", () =>
      expect(this.targetTranscriptBlock()).toHaveCount(0),
    );
  verifyShowsOverviewPanel = () => this.expectToBeVisible(readerPageTestIds.overviewPanel);

  scrollDown = (pixels: number) =>
    this.step(`scrollDown ${pixels}`, async () => {
      await this.page.mouse.wheel(0, pixels);
      await this.page.waitForTimeout(300);
    });

  // The block across the middle of the window, which is what the reading position
  // remembers (docs/features/reading-position.md).
  readTranscriptBlockAtCentre = (): Promise<string | null> =>
    this.step("readTranscriptBlockAtCentre", () =>
      this.page.evaluate(
        ({ rowId, textId }) => {
          const centre = window.innerHeight / 2;
          const rows = Array.from(document.querySelectorAll(`[data-testid="${rowId}"]`));
          const row = rows.find((candidate) => {
            const rect = candidate.getBoundingClientRect();
            return rect.top <= centre && rect.bottom >= centre;
          });
          return row?.querySelector(`[data-testid="${textId}"]`)?.textContent ?? null;
        },
        { rowId: transcriptPanelTestIds.row, textId: transcriptPanelTestIds.rowText },
      ),
    );

  verifyTranscriptBlockAtCentreReads = (text: string) =>
    this.step(`verifyTranscriptBlockAtCentreReads ${text}`, () =>
      expect.poll(() => this.readTranscriptBlockAtCentre(), { timeout: 2_000 }).toBe(text),
    );

  verifyTranscriptIsAtTheTop = () =>
    this.step("verifyTranscriptIsAtTheTop", () =>
      expect.poll(() => this.page.evaluate(() => window.scrollY), { timeout: 2_000 }).toBe(0),
    );

  // The panel's whole sticky stack, in the order it has to rest in: the app's bar, the
  // note's own head, the tabs, and — on the transcript — its tools.
  verifyPanelChromeStacks = (withTranscriptTools: boolean) =>
    this.step(`verifyPanelChromeStacks ${withTranscriptTools}`, () =>
      expect(async () => {
        const appBar = (await this.page.getByTestId(appShellTestIds.masthead).boundingBox())!;
        const head = (await this.get(readerMastheadTestIds.root).boundingBox())!;
        const tabs = (await this.get(readerTabsTestIds.root).boundingBox())!;

        expect(Math.round(head.y)).toBe(Math.round(appBar.y + appBar.height));
        expect(Math.round(tabs.y)).toBe(Math.round(head.y + head.height));

        if (withTranscriptTools) {
          const tools = (await this.get(transcriptPanelTestIds.tools).boundingBox())!;
          expect(Math.round(tools.y)).toBeGreaterThanOrEqual(Math.round(tabs.y + tabs.height));
        }
      }).toPass({ timeout: 2_000 }),
    );

  verifyPlusPromptHoldsTheWindowFoot = () =>
    this.step("verifyPlusPromptHoldsTheWindowFoot", () =>
      expect(async () => {
        const prompt = (await this.get(plusPromptTestIds.root).boundingBox())!;
        const viewport = this.page.viewportSize()!;
        expect(Math.round(prompt.y + prompt.height)).toBe(viewport.height);
      }).toPass({ timeout: 2_000 }),
    );

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
