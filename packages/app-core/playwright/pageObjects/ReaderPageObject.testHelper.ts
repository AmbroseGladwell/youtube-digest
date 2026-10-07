import { expect } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import { readerPageTestIds } from "../../src/features/reader/ReaderPage/ReaderPageTestIds.js";
import { captureReasonLineTestIds } from "../../src/features/reader/components/CaptureReasonLine/CaptureReasonLineTestIds.js";
import { readAlongNoteTestIds } from "../../src/features/reader/components/ReadAlongNote/ReadAlongNoteTestIds.js";
import { readerMastheadTestIds } from "../../src/features/reader/components/ReaderMasthead/ReaderMastheadTestIds.js";
import { readerPlayerBarTestIds } from "../../src/features/reader/components/ReaderPlayerBar/ReaderPlayerBarTestIds.js";
import { playerScrubberTestIds } from "../../src/features/player/components/PlayerScrubber/PlayerScrubberTestIds.js";
import { readerTabsTestIds } from "../../src/features/reader/components/ReaderTabs/ReaderTabsTestIds.js";
import { chaptersPanelTestIds } from "../../src/features/reader/components/ChaptersPanel/ChaptersPanelTestIds.js";
import { topicLineTestIds } from "../../src/features/reader/components/TopicLine/TopicLineTestIds.js";
import { overviewActionsMenuTestIds } from "../../src/features/reader/components/OverviewActionsMenu/OverviewActionsMenuTestIds.js";
import { TopicPickerPageObject } from "./TopicPickerPageObject.testHelper.js";
import { transcriptPanelTestIds } from "../../src/features/reader/components/TranscriptPanel/TranscriptPanelTestIds.js";
import { TRANSCRIPT_REST_GAP } from "../../src/features/reader/components/TranscriptPanel/transcriptRestingLine.js";
import { lineRangeTagTestIds } from "../../src/features/reader/components/LineRangeTag/LineRangeTagTestIds.js";
import { savedLocallyNoteTestIds } from "../../src/features/plus/components/SavedLocallyNote/SavedLocallyNoteTestIds.js";
import { appShellTestIds } from "../../src/shell/AppShell/AppShellTestIds.js";
import { savedChipTestIds } from "../../src/features/timeSaved/components/SavedChip/SavedChipTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { RelatedByTagPageObject } from "./RelatedByTagPageObject.testHelper.js";
import { LibraryPageObject } from "./LibraryPageObject.testHelper.js";
import { DeleteOverviewDialogPageObject } from "./DeleteOverviewDialogPageObject.testHelper.js";
import { DubiousReasonsPanelPageObject } from "./DubiousReasonsPanelPageObject.testHelper.js";
import { ShareOverviewDialogPageObject } from "./ShareOverviewDialogPageObject.testHelper.js";
import { SettingsPageObject } from "./SettingsPageObject.testHelper.js";
import { playlistFromLineTestIds } from "../../src/features/playlists/components/PlaylistFromLine/PlaylistFromLineTestIds.js";

export class ReaderPageObject extends PageObject {
  get relatedByTag(): RelatedByTagPageObject {
    return new RelatedByTagPageObject(this.testContext);
  }

  verifyIsShown = (): Promise<ReaderPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(readerPageTestIds.root);
      return this;
    });

  verifyFromLine = (text: string | null, manage: boolean) =>
    this.step(`verifyFromLine ${text} ${manage}`, async () => {
      if (text === null) {
        await this.expectToHaveCount(playlistFromLineTestIds.root, 0);
        return;
      }
      await expect(this.get(playlistFromLineTestIds.root)).toContainText(text);
      if (manage) await this.expectToBeVisible(playlistFromLineTestIds.manageLink);
      else await this.expectToHaveCount(playlistFromLineTestIds.manageLink, 0);
    });

  openManagePlaylists = () => this.step("openManagePlaylists", () => this.click(playlistFromLineTestIds.manageLink));

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
      expect(this.get(readerPageTestIds.position)).toHaveText(position),
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

  closeActionsMenu = () => this.step("closeActionsMenu", () => this.page.keyboard.press("Escape"));

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

  // Same line, measured rather than assumed: design 4a puts the verdict and the warnings
  // on the channel's line, above the title, rather than in a second band. Overlap rather
  // than a shared top edge — a chip carries padding that plain text on the same line does
  // not, so their boxes start a couple of pixels apart.
  verifyJudgementSharesTheChannelLine = () =>
    this.step("verifyJudgementSharesTheChannelLine", () =>
      expect(async () => {
        const rowOf = async (locator: Locator) => {
          const box = (await locator.boundingBox())!;
          return { top: box.y, bottom: box.y + box.height };
        };
        const chip = await rowOf(this.get(readerMastheadTestIds.channel));
        const masthead = this.get(readerMastheadTestIds.root);
        const novelty = await rowOf(masthead.getByText("Original", { exact: true }));
        const dubious = await rowOf(masthead.getByText(/Dubious claim/));

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

  verifyNoLineIsActive = () =>
    this.step("verifyNoLineIsActive", () => this.expectNotToBeVisible(readAlongNoteTestIds.activeLine));

  verifyBulletedLinesRead = (texts: string[]) =>
    this.step(`verifyBulletedLinesRead ${texts.join(", ")}`, () =>
      expect(
        this.get(readAlongNoteTestIds.line)
          .or(this.get(readAlongNoteTestIds.activeLine))
          .filter({ has: this.page.getByTestId(readAlongNoteTestIds.bullet) })
          .getByTestId(readAlongNoteTestIds.lineText),
      ).toHaveText(texts),
    );

  verifyNoteShowsLine = (text: string, shown: boolean) =>
    this.step(`verifyNoteShowsLine ${text} ${shown}`, () => {
      const line = this.get(readAlongNoteTestIds.line)
        .or(this.get(readAlongNoteTestIds.activeLine))
        .getByTestId(readAlongNoteTestIds.lineText)
        .filter({ hasText: text });
      return shown ? expect(line).toBeVisible() : expect(line).toHaveCount(0);
    });

  verifyNoteLabelsRead = (labels: string[]) =>
    this.step(`verifyNoteLabelsRead ${labels.join(", ")}`, () =>
      expect(this.get(readAlongNoteTestIds.lineLabel)).toHaveText(labels),
    );

  verifyVerdictChipReads = (text: string) =>
    this.step(`verifyVerdictChipReads ${text}`, () => expect(this.get(readAlongNoteTestIds.chip)).toHaveText(text));

  verifyNoteCaptionReads = (text: string) =>
    this.step(`verifyNoteCaptionReads ${text}`, () => expect(this.get(readAlongNoteTestIds.caption)).toHaveText(text));

  clickLineWithText = (text: string) =>
    this.step(`clickLineWithText ${text}`, () =>
      this.get(readAlongNoteTestIds.line).filter({ hasText: text }).first().click(),
    );

  clickPlayPause = () =>
    this.step("clickPlayPause", () => this.click(readerPlayerBarTestIds.playButton));
  clickSkipForward = () =>
    this.step("clickSkipForward", () => this.click(readerPlayerBarTestIds.skipForwardButton));
  clickSkipBack = () => this.step("clickSkipBack", () => this.click(readerPlayerBarTestIds.skipBackButton));

  // Design 2: [ and ] step the spoken line, from anywhere on the page but a field.
  pressLineKey = (key: "[" | "]") =>
    this.step(`pressLineKey ${key}`, () => this.page.keyboard.press(key === "[" ? "BracketLeft" : "BracketRight"));

  verifyPlayButtonReads = (label: string) =>
    this.step(`verifyPlayButtonReads ${label}`, () =>
      expect(this.get(readerPlayerBarTestIds.playButton)).toHaveAttribute("aria-label", label),
    );

  verifySkipIsEnabled = (enabled: boolean) =>
    this.step(`verifySkipIsEnabled ${enabled}`, async () => {
      for (const testId of [readerPlayerBarTestIds.skipBackButton, readerPlayerBarTestIds.skipForwardButton]) {
        await (enabled ? expect(this.get(testId)).toBeEnabled() : expect(this.get(testId)).toBeDisabled());
      }
    });

  // The label line is the bar's live region: every state says itself there.
  verifyBarSays = (text: string | RegExp) =>
    this.step(`verifyBarSays ${String(text)}`, () =>
      expect(this.get(readerPlayerBarTestIds.label)).toHaveText(text, { timeout: 10_000 }),
    );

  verifyBarClockReads = (text: string | RegExp) =>
    this.step(`verifyBarClockReads ${String(text)}`, () =>
      expect(this.get(readerPlayerBarTestIds.clock)).toHaveText(text),
    );

  verifyIsThePacer = (pacer: boolean) =>
    this.step(`verifyIsThePacer ${pacer}`, () =>
      pacer
        ? this.expectToBeVisible(readerPlayerBarTestIds.pacerTag)
        : this.expectNotToBeVisible(readerPlayerBarTestIds.pacerTag),
    );

  // Design 43i: the voice the bar names opens the voice setting, wherever the bar is.
  openVoiceSettingFromBar = (): Promise<SettingsPageObject> =>
    this.step("openVoiceSettingFromBar", async () => {
      await this.click(readerPlayerBarTestIds.voiceLink);
      return new SettingsPageObject(this.testContext).verifyIsShown();
    });

  // Design 43j: a pill beside the rate on the web bar, a link on the label line in the panel.
  clickReRecord = () =>
    this.step("clickReRecord", async () => {
      const pill = this.get(readerPlayerBarTestIds.reRecordButton);
      await ((await pill.isVisible()) ? pill.click() : this.click(readerPlayerBarTestIds.reRecordInline));
    });

  verifyOffersReRecord = (label: string | null) =>
    this.step(`verifyOffersReRecord ${String(label)}`, () =>
      label === null
        ? this.expectToHaveCount(readerPlayerBarTestIds.reRecordButton, 0)
        : expect(this.get(readerPlayerBarTestIds.reRecordButton)).toHaveText(label),
    );

  clickBarAction = (action: string) =>
    this.step(`clickBarAction ${action}`, () => this.click(readerPlayerBarTestIds.action(action)));

  verifyOffersBarAction = (action: string, offered: boolean) =>
    this.step(`verifyOffersBarAction ${action} ${offered}`, () =>
      offered
        ? this.expectToBeVisible(readerPlayerBarTestIds.action(action))
        : this.expectNotToBeVisible(readerPlayerBarTestIds.action(action)),
    );

  verifyOffersSignInForAudio = (offered: boolean) =>
    this.step(`verifyOffersSignInForAudio ${offered}`, () =>
      offered
        ? this.expectToBeVisible(readerPlayerBarTestIds.signInLink)
        : this.expectNotToBeVisible(readerPlayerBarTestIds.signInLink),
    );

  verifyShowsPreparingSweep = () =>
    this.step("verifyShowsPreparingSweep", () => this.expectToBeVisible(playerScrubberTestIds.sweep));

  // Where the scrubber says the clock is, read off the slider rather than the text so it
  // holds on every surface.
  readScrubberSeconds = (): Promise<number> =>
    this.step("readScrubberSeconds", async () =>
      Number(await this.get(playerScrubberTestIds.root).getAttribute("aria-valuenow")),
    );

  verifyScrubberSecondsAtLeast = (seconds: number) =>
    this.step(`verifyScrubberSecondsAtLeast ${seconds}`, () =>
      expect.poll(() => this.readScrubberSeconds(), { timeout: 10_000 }).toBeGreaterThanOrEqual(seconds),
    );

  // Design 2a: held partway along, the scrubber names where it will land, and letting go
  // lands there.
  dragScrubberTo = (fraction: number): Promise<string> =>
    this.step(`dragScrubberTo ${fraction}`, async () => {
      const box = (await this.get(playerScrubberTestIds.root).boundingBox())!;
      const y = box.y + box.height / 2;
      await this.page.mouse.move(box.x + 1, y);
      await this.page.mouse.down();
      await this.page.mouse.move(box.x + box.width * fraction, y, { steps: 4 });
      const landing = (await this.get(playerScrubberTestIds.tooltip).textContent()) ?? "";
      await this.page.mouse.up();
      return landing;
    });

  pressOnScrubber = (key: string) =>
    this.step(`pressOnScrubber ${key}`, async () => {
      await this.get(playerScrubberTestIds.root).focus();
      await this.page.keyboard.press(key);
    });

  clickRate = () => this.step("clickRate", () => this.click(readerPlayerBarTestIds.rateButton));
  clickFavourite = () =>
    this.step("clickFavourite", () => this.click(readerMastheadTestIds.favouriteButton));

  // The head's circle is the row's circle: the control keeps its shape between a row and
  // the note that row opens, which is the whole reason the two sizes are one number.
  verifyFavouriteMatchesTheRow = (size: number) =>
    this.step(`verifyFavouriteMatchesTheRow ${size}`, async () => {
      const box = (await this.get(readerMastheadTestIds.favouriteButton).boundingBox())!;
      expect(Math.round(box.width)).toBe(size);
      expect(Math.round(box.height)).toBe(size);
    });

  // Design 4b: read state lives in the ⋯ menu, so marking read is a menu choice.
  clickMarkRead = () =>
    this.step("clickMarkRead", async () => {
      await this.openActionsMenu();
      await this.click(overviewActionsMenuTestIds.readItem);
    });

  verifySavedChipSays = (text: string) =>
    this.step(`verifySavedChipSays ${text}`, () => expect(this.get(savedChipTestIds.root)).toContainText(text));

  verifyNoSavedChip = () => this.step("verifyNoSavedChip", () => this.expectNotToBeVisible(savedChipTestIds.root));

  clickShare = (): Promise<ShareOverviewDialogPageObject> =>
    this.step("clickShare", async () => {
      await this.openActionsMenu();
      await this.click(overviewActionsMenuTestIds.shareItem);
      return new ShareOverviewDialogPageObject(this.testContext).verifyIsShown();
    });

  verifyMenuHasNoShare = () =>
    this.step("verifyMenuHasNoShare", async () => {
      await this.openActionsMenu();
      await this.expectNotToBeVisible(overviewActionsMenuTestIds.shareItem);
    });

  verifyOpensInWebAppAt = (href: string) =>
    this.step(`verifyOpensInWebAppAt ${href}`, async () => {
      await this.openActionsMenu();
      await expect(this.get(overviewActionsMenuTestIds.openInWebItem)).toHaveAttribute("href", href);
      await expect(this.get(overviewActionsMenuTestIds.openInWebItem)).toBeEnabled();
    });

  verifyCannotOpenInWebApp = (reason: string) =>
    this.step(`verifyCannotOpenInWebApp ${reason}`, async () => {
      await this.openActionsMenu();
      await expect(this.get(overviewActionsMenuTestIds.openInWebItem)).toBeDisabled();
      await expect(this.get(overviewActionsMenuTestIds.openInWebReason)).toHaveText(reason);
    });

  verifyMenuHasNoOpenInWebApp = () =>
    this.step("verifyMenuHasNoOpenInWebApp", async () => {
      await this.openActionsMenu();
      await this.expectNotToBeVisible(overviewActionsMenuTestIds.openInWebItem);
    });

  verifyCopyLinkItemReads = (label: string) =>
    this.step(`verifyCopyLinkItemReads ${label}`, async () => {
      await this.openActionsMenu();
      await expect(this.get(overviewActionsMenuTestIds.copyLinkItem)).toHaveText(label);
    });

  clickDubiousFlag = (): Promise<DubiousReasonsPanelPageObject> =>
    this.step("clickDubiousFlag", async () => {
      await this.click(readerMastheadTestIds.dubiousFlag);
      await expect(this.get(readerMastheadTestIds.dubiousFlag)).toHaveAttribute("aria-expanded", "true");
      return new DubiousReasonsPanelPageObject(this.testContext).verifyIsShown();
    });

  clickDubiousFlagToClose = () =>
    this.step("clickDubiousFlagToClose", async () => {
      await this.click(readerMastheadTestIds.dubiousFlag);
      await expect(this.get(readerMastheadTestIds.dubiousFlag)).toHaveAttribute("aria-expanded", "false");
    });

  openDubiousReasonsByKeyboard = (): Promise<DubiousReasonsPanelPageObject> =>
    this.step("openDubiousReasonsByKeyboard", async () => {
      await this.get(readerMastheadTestIds.dubiousFlag).focus();
      await this.page.keyboard.press("Enter");
      return new DubiousReasonsPanelPageObject(this.testContext).verifyIsShown();
    });

  verifyDubiousFlagIsNamed = (name: string) =>
    this.step(`verifyDubiousFlagIsNamed ${name}`, () =>
      expect(this.get(readerMastheadTestIds.dubiousFlag)).toHaveAccessibleName(name),
    );

  verifyDubiousFlagIsFocused = () =>
    this.step("verifyDubiousFlagIsFocused", () => expect(this.get(readerMastheadTestIds.dubiousFlag)).toBeFocused());

  verifyHasNoDubiousFlag = () =>
    this.step("verifyHasNoDubiousFlag", () => this.expectNotToBeVisible(readerMastheadTestIds.dubiousFlag));

  clickDeleteOverview = (): Promise<DeleteOverviewDialogPageObject> =>
    this.step("clickDeleteOverview", async () => {
      await this.openActionsMenu();
      await this.click(overviewActionsMenuTestIds.deleteItem);
      return new DeleteOverviewDialogPageObject(this.testContext).verifyIsShown();
    });

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
    this.step("clickNextOverview", () => this.click(readerPageTestIds.nextLink));

  clickPreviousOverview = () =>
    this.step("clickPreviousOverview", () => this.click(readerPageTestIds.previousLink));

  verifyRateReads = (rate: string) =>
    this.step(`verifyRateReads ${rate}`, () =>
      expect(this.get(readerPlayerBarTestIds.rateButton)).toHaveText(rate),
    );

  verifyIsFavourited = (isFavourited: boolean) =>
    this.step(`verifyIsFavourited ${isFavourited}`, () =>
      expect(this.get(readerMastheadTestIds.favouriteButton)).toHaveAttribute(
        "aria-pressed",
        String(isFavourited),
      ),
    );

  // Read state is reported by what the menu offers to do next, so the menu is opened to
  // read it and put away again.
  verifyIsRead = (isRead: boolean) =>
    this.step(`verifyIsRead ${isRead}`, async () => {
      await this.openActionsMenu();
      await expect(this.get(overviewActionsMenuTestIds.readItem)).toHaveText(
        isRead ? "Mark as unread" : "Mark as read",
      );
      await this.clickAwayFromAnyPopover();
    });

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

  clickClearSearch = () =>
    this.step("clickClearSearch", () => this.click(transcriptPanelTestIds.clearSearchButton));

  verifyOffersToClearTheSearch = (offered: boolean) =>
    this.step(`verifyOffersToClearTheSearch ${offered}`, () =>
      offered
        ? this.expectToBeVisible(transcriptPanelTestIds.clearSearchButton)
        : this.expectNotToBeVisible(transcriptPanelTestIds.clearSearchButton),
    );

  verifySearchReads = (query: string) =>
    this.step(`verifySearchReads ${query}`, () =>
      expect(this.get(transcriptPanelTestIds.searchInput)).toHaveValue(query),
    );

  pressInTheSearchField = (key: string) =>
    this.step(`pressInTheSearchField ${key}`, () =>
      this.get(transcriptPanelTestIds.searchInput).press(key),
    );

  verifyMatchSteppersAreDisabled = () =>
    this.step("verifyMatchSteppersAreDisabled", async () => {
      await expect(this.get(transcriptPanelTestIds.previousMatchButton)).toBeDisabled();
      await expect(this.get(transcriptPanelTestIds.nextMatchButton)).toBeDisabled();
    });

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

  // The raised card bleeds past the paragraph it holds, so the sticky head has to be
  // wider than the card it hides, not as wide as the text under it.
  verifyTranscriptHeadHidesTheBlocksPassingUnderIt = () =>
    this.step("verifyTranscriptHeadHidesTheBlocksPassingUnderIt", async () => {
      const head = (await this.get(transcriptPanelTestIds.head).boundingBox())!;
      const card = (await this.get(transcriptPanelTestIds.row).first().boundingBox())!;
      expect(head.x).toBeLessThanOrEqual(card.x);
      expect(head.x + head.width).toBeGreaterThanOrEqual(card.x + card.width);
    });

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

  verifyFollowButtonReads = (label: string) =>
    this.step(`verifyFollowButtonReads ${label}`, () =>
      expect(this.get(transcriptPanelTestIds.followButton)).toHaveText(label),
    );

  verifyCurrentBlockSaysPlaying = () =>
    this.step("verifyCurrentBlockSaysPlaying", () =>
      expect(
        this.get(transcriptPanelTestIds.row)
          .and(this.page.locator('[data-current="true"]'))
          .getByTestId(transcriptPanelTestIds.playingBadge),
      ).toHaveText("Playing on YouTube"),
    );

  verifyTargetBlockNamesChapter = (label: string) =>
    this.step(`verifyTargetBlockNamesChapter ${label}`, () =>
      expect(
        this.targetTranscriptBlock().getByTestId(transcriptPanelTestIds.chapterChip),
      ).toHaveText(label),
    );

  clickBackToChapters = () =>
    this.step("clickBackToChapters", () =>
      this.click(transcriptPanelTestIds.backToChaptersButton),
    );

  verifyCurrentChapterShowsProgress = () =>
    this.step("verifyCurrentChapterShowsProgress", () =>
      expect(
        this.get(chaptersPanelTestIds.row)
          .and(this.page.locator('[data-current="true"]'))
          .getByTestId(chaptersPanelTestIds.progress),
      ).toHaveAttribute("aria-valuenow", /^\d+$/),
    );

  verifyChaptersAreFollowingTheVideo = (following: boolean) =>
    this.step(`verifyChaptersAreFollowingTheVideo ${following}`, () =>
      following
        ? this.expectToBeVisible(chaptersPanelTestIds.followingNote)
        : this.expectNotToBeVisible(chaptersPanelTestIds.followingNote),
    );

  verifyLineTimesRead = (labels: string[]) =>
    this.step(`verifyLineTimesRead ${labels.join(", ")}`, () =>
      expect(this.get(lineRangeTagTestIds.tag)).toHaveText(labels),
    );

  openLineTime = (label: string) =>
    this.step(`openLineTime ${label}`, async () => {
      const tag = this.get(lineRangeTagTestIds.tag).filter({ hasText: new RegExp(`^${label}$`) });
      await tag.click();
      await expect(tag).toHaveAttribute("aria-expanded", "true");
    });

  verifyLineMenuRangeReads = (range: string) =>
    this.step(`verifyLineMenuRangeReads ${range}`, () =>
      expect(this.get(lineRangeTagTestIds.menuRange)).toHaveText(range),
    );

  verifyLineMenuIsOpen = (open: boolean) =>
    this.step(`verifyLineMenuIsOpen ${open}`, () =>
      open ? this.expectToBeVisible(lineRangeTagTestIds.menu) : this.expectNotToBeVisible(lineRangeTagTestIds.menu),
    );

  verifyLineTimeIsFocused = (label: string) =>
    this.step(`verifyLineTimeIsFocused ${label}`, () =>
      expect(this.get(lineRangeTagTestIds.tag).filter({ hasText: new RegExp(`^${label}$`) })).toBeFocused(),
    );

  verifyLineMenuNames = (lineText: string) =>
    this.step(`verifyLineMenuNames ${lineText}`, () => expect(this.get(lineRangeTagTestIds.menu)).toContainText(lineText));

  clickOutsideLineMenu = () =>
    this.step("clickOutsideLineMenu", () => this.get(lineRangeTagTestIds.scrim).click({ position: { x: 10, y: 10 } }));

  clickReadInTranscript = () =>
    this.step("clickReadInTranscript", () => this.click(lineRangeTagTestIds.transcriptButton));

  clickReadInTranscriptAt = (label: string) =>
    this.step(`clickReadInTranscriptAt ${label}`, async () => {
      await this.openLineTime(label);
      await this.clickReadInTranscript();
    });

  verifyOffersToWatchFrom = (label: string, url: string) =>
    this.step(`verifyOffersToWatchFrom ${label}`, async () => {
      const link = this.get(lineRangeTagTestIds.watchLink);
      await expect(link).toHaveText(label);
      await expect(link).toHaveAttribute("href", url);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAccessibleName(`${label} on YouTube, opens in a new tab`);
    });

  verifyOffersToWatchOnYouTube = (offered: boolean) =>
    this.step(`verifyOffersToWatchOnYouTube ${offered}`, () =>
      offered
        ? this.expectToBeVisible(lineRangeTagTestIds.watchLink)
        : this.expectNotToBeVisible(lineRangeTagTestIds.watchLink),
    );

  verifyOffersToSkipTheVideo = (offered: boolean) =>
    this.step(`verifyOffersToSkipTheVideo ${offered}`, () =>
      offered
        ? this.expectToBeVisible(lineRangeTagTestIds.skipButton)
        : this.expectNotToBeVisible(lineRangeTagTestIds.skipButton),
    );

  clickSkipTo = () => this.step("clickSkipTo", () => this.click(lineRangeTagTestIds.skipButton));

  clickListen = () =>
    this.step("clickListen", () => this.click(readerMastheadTestIds.listenButton));

  verifyListenReads = (label: string) =>
    this.step(`verifyListenReads ${label}`, () =>
      expect(this.get(readerMastheadTestIds.listenButton)).toHaveText(label),
    );

  clickPanelMarkRead = () =>
    this.step("clickPanelMarkRead", () => this.click(readerMastheadTestIds.readButton));

  verifyPanelReadButtonReads = (label: string) =>
    this.step(`verifyPanelReadButtonReads ${label}`, () =>
      expect(this.get(readerMastheadTestIds.readButton)).toHaveText(label),
    );

  verifyPlayerIsDocked = (docked: boolean) =>
    this.step(`verifyPlayerIsDocked ${docked}`, () =>
      docked
        ? this.expectToBeVisible(readerPlayerBarTestIds.root)
        : this.expectNotToBeVisible(readerPlayerBarTestIds.root),
    );

  verifySavedLocallyNoteIsShown = (shown: boolean) =>
    this.step(`verifySavedLocallyNoteIsShown ${shown}`, () =>
      shown
        ? this.expectToBeVisible(savedLocallyNoteTestIds.root)
        : this.expectNotToBeVisible(savedLocallyNoteTestIds.root),
    );

  dismissSavedLocallyNote = () =>
    this.step("dismissSavedLocallyNote", () =>
      this.click(savedLocallyNoteTestIds.dismissButton),
    );

  verifyMastheadIsPanelSized = () =>
    this.step("verifyMastheadIsPanelSized", async () => {
      await this.expectNotToBeVisible(readerMastheadTestIds.backLink);
      await this.expectNotToBeVisible(readerMastheadTestIds.favouriteButton);
      await this.expectNotToBeVisible(readerMastheadTestIds.readAloudButton);
    });

  verifyShowsNoStoredTranscript = () => this.expectToBeVisible(transcriptPanelTestIds.emptyNote);
  verifyShowsTranscriptSkeleton = () => this.expectToBeVisible(transcriptPanelTestIds.skeleton);
  verifyTranscriptFailedReads = (pattern: RegExp) =>
    this.step(`verifyTranscriptFailedReads ${pattern.source}`, () =>
      expect(this.get(transcriptPanelTestIds.errorNote)).toHaveText(pattern),
    );
  clickRetryTranscript = () =>
    this.step("clickRetryTranscript", () => this.click(transcriptPanelTestIds.retryButton));
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
    this.step(`verifyChaptersOfferTranscript ${offered}`, async () => {
      const buttons = this.get(chaptersPanelTestIds.transcriptButton);
      await expect(buttons).toHaveCount(await this.get(chaptersPanelTestIds.row).count());
      for (const button of await buttons.all()) {
        await (offered ? expect(button).toBeEnabled() : expect(button).toBeDisabled());
      }
    });

  verifyChapterTranscriptReasonIs = (reason: string) =>
    this.step(`verifyChapterTranscriptReasonIs ${reason}`, () =>
      expect(this.get(chaptersPanelTestIds.transcriptButton).first()).toHaveAttribute("title", reason),
    );

  verifyActiveTabIs = (tab: string) =>
    this.step(`verifyActiveTabIs ${tab}`, () =>
      expect(this.get(readerTabsTestIds.tab(tab))).toHaveAttribute("aria-selected", "true"),
    );

  private targetTranscriptBlock = (): Locator =>
    this.get(transcriptPanelTestIds.row).and(this.page.locator('[data-target="true"]'));

  private currentTranscriptBlock = (): Locator =>
    this.get(transcriptPanelTestIds.row).and(this.page.locator('[data-current="true"]'));

  verifyTargetTranscriptBlockReads = (text: string | RegExp) =>
    this.step(`verifyTargetTranscriptBlockReads ${String(text)}`, async () => {
      await expect(
        this.targetTranscriptBlock().getByTestId(transcriptPanelTestIds.rowText),
      ).toHaveText(text);
      await expect(this.targetTranscriptBlock()).toBeInViewport();
      const head = (await this.get(transcriptPanelTestIds.head).boundingBox())!;
      const row = (await this.targetTranscriptBlock().boundingBox())!;
      expect(row.y).toBeGreaterThanOrEqual(head.y + head.height);
    });

  verifyNoTranscriptBlockIsTargeted = () =>
    this.step("verifyNoTranscriptBlockIsTargeted", () =>
      expect(this.targetTranscriptBlock()).toHaveCount(0),
    );
  verifyShowsOverviewPanel = () => this.expectToBeVisible(readerPageTestIds.overviewPanel);

  // Scrolled by script and confirmed, rather than a wheel event and a fixed pause: under
  // load a wheel event can land after the pause has ended. The target is retried while the
  // page is still growing, and a page too short for it counts once its height has settled.
  scrollDown = (pixels: number) =>
    this.step(`scrollDown ${pixels}`, async () => {
      const target = Math.max(0, (await this.page.evaluate(() => window.scrollY)) + pixels);
      const started = Date.now();
      let lastHeight = -1;
      await expect
        .poll(
          async () => {
            const { y, height, limit } = await this.page.evaluate((to) => {
              window.scrollTo({ top: to, behavior: "instant" });
              return {
                y: window.scrollY,
                height: document.documentElement.scrollHeight,
                limit: document.documentElement.scrollHeight - window.innerHeight,
              };
            }, target);
            const settled = height === lastHeight && Date.now() - started >= 300;
            lastHeight = height;
            return y === target || (y >= limit && settled);
          },
          { timeout: 3_000 },
        )
        .toBe(true);
    });

  // The block across the middle of the window, which is what the reading position
  // remembers (docs/features/reading-position.md).
  // Where the transcript says you are: the first block that starts below the sticky head,
  // which is the one a block scrolled to comes to rest as
  // (`transcriptRestingLine.ts`).
  readTranscriptBlockAtTheRestingLine = (): Promise<string | null> =>
    this.step("readTranscriptBlockAtTheRestingLine", () =>
      this.page.evaluate(
        ({ rowId, textId, headId, gap }) => {
          const head = document.querySelector(`[data-testid="${headId}"]`);
          if (head === null) {
            return null;
          }
          const line = head.getBoundingClientRect().bottom + gap;
          const row = Array.from(document.querySelectorAll(`[data-testid="${rowId}"]`)).find(
            (candidate) => candidate.getBoundingClientRect().top >= line - 1,
          );
          return row?.querySelector(`[data-testid="${textId}"]`)?.textContent ?? null;
        },
        {
          rowId: transcriptPanelTestIds.row,
          textId: transcriptPanelTestIds.rowText,
          headId: transcriptPanelTestIds.head,
          gap: TRANSCRIPT_REST_GAP,
        },
      ),
    );

  verifyTranscriptBlockAtTheRestingLineReads = (text: string) =>
    this.step(`verifyTranscriptBlockAtTheRestingLineReads ${text}`, () =>
      expect.poll(() => this.readTranscriptBlockAtTheRestingLine(), { timeout: 2_000 }).toBe(text),
    );

  // What the reported bug was: a block the transcript scrolled to came to rest behind the
  // sticky head, and the taller the block the more of it went.
  verifyCurrentTranscriptBlockIsWhollyBelowTheHead = () =>
    this.step("verifyCurrentTranscriptBlockIsWhollyBelowTheHead", () =>
      expect(async () => {
        const head = (await this.get(transcriptPanelTestIds.head).boundingBox())!;
        const row = (await this.currentTranscriptBlock().boundingBox())!;
        expect(row.y).toBeGreaterThanOrEqual(head.y + head.height);
      }).toPass({ timeout: 2_000 }),
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

  // Flush on a narrow panel, a rem in from the foot where the bar floats as a card.
  verifyPlayerHoldsTheWindowFoot = () =>
    this.step("verifyPlayerHoldsTheWindowFoot", () =>
      expect(async () => {
        const bar = (await this.get(readerPlayerBarTestIds.root).boundingBox())!;
        const viewport = this.page.viewportSize()!;
        const gap = viewport.height - Math.round(bar.y + bar.height);
        expect(gap).toBeGreaterThanOrEqual(0);
        expect(gap).toBeLessThanOrEqual(16);
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
