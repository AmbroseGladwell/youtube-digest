import { expect } from "@playwright/experimental-ct-react";
import { chatCodeBlockTestIds } from "../../src/features/chats/components/ChatCodeBlock/ChatCodeBlockTestIds.js";
import { chatMarkedTextTestIds } from "../../src/features/chats/components/ChatMarkedText/ChatMarkedTextTestIds.js";
import { chatAnswerTestIds } from "../../src/features/chats/components/ChatAnswer/ChatAnswerTestIds.js";
import { chatComposerTestIds } from "../../src/features/chats/components/ChatComposer/ChatComposerTestIds.js";
import { chatChipRowTestIds } from "../../src/features/chats/components/ChatChipRow/ChatChipRowTestIds.js";
import { chatDrewOnTestIds } from "../../src/features/chats/components/ChatDrewOn/ChatDrewOnTestIds.js";
import { chatSourceChipTestIds } from "../../src/features/chats/components/ChatSourceChip/ChatSourceChipTestIds.js";
import { chatAnswerActionsTestIds } from "../../src/features/chats/components/ChatAnswerActions/ChatAnswerActionsTestIds.js";
import { chatConversationListTestIds } from "../../src/features/chats/components/ChatConversationList/ChatConversationListTestIds.js";
import { chatConversationMenuTestIds } from "../../src/features/chats/components/ChatConversationMenu/ChatConversationMenuTestIds.js";
import { chatWaitBlockTestIds } from "../../src/features/chats/components/ChatWaitBlock/ChatWaitBlockTestIds.js";
import { chatSheetTestIds } from "../../src/features/chats/components/ChatSheet/ChatSheetTestIds.js";
import { chatOtherOverviewCitationTestIds } from "../../src/features/chats/components/ChatOtherOverviewCitation/ChatOtherOverviewCitationTestIds.js";
import { chatOverviewCitationTestIds } from "../../src/features/chats/components/ChatOverviewCitation/ChatOverviewCitationTestIds.js";
import { readerPageTestIds } from "../../src/features/reader/ReaderPage/ReaderPageTestIds.js";
import { chatCitationPillTestIds } from "../../src/features/chats/components/ChatCitationPill/ChatCitationPillTestIds.js";
import { chatFieldTestIds } from "../../src/features/chats/components/ChatField/ChatFieldTestIds.js";
import { chatPanelTestIds } from "../../src/features/chats/components/ChatPanel/ChatPanelTestIds.js";
import { noteAskFieldTestIds } from "../../src/features/chats/components/NoteAskField/NoteAskFieldTestIds.js";
import { overviewActionsMenuTestIds } from "../../src/features/reader/components/OverviewActionsMenu/OverviewActionsMenuTestIds.js";
import { readAlongNoteTestIds } from "../../src/features/reader/components/ReadAlongNote/ReadAlongNoteTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { SettingsPageObject } from "./SettingsPageObject.testHelper.js";

// Chat about one overview, beside its note on the web (OV-310; docs/features/chats.md).
export class ChatPanelPageObject extends PageObject {
  private panel = () => this.page.getByTestId(chatPanelTestIds.root);
  private field = () => this.panel().getByTestId(chatFieldTestIds.input);
  private answers = () => this.panel().getByTestId(chatAnswerTestIds.root);

  askInNote = (question: string) =>
    this.step(`askInNote ${question}`, async () => {
      const field = this.get(noteAskFieldTestIds.root).getByTestId(chatFieldTestIds.input);
      await field.fill(question);
      await field.press("Enter");
    });

  verifyNoteFieldIs = (shown: boolean) =>
    this.step(`verifyNoteFieldIs ${shown}`, () =>
      shown ? expect(this.get(noteAskFieldTestIds.root)).toBeVisible() : expect(this.get(noteAskFieldTestIds.root)).toBeHidden(),
    );

  verifyNoteFieldIsAbsent = () => this.step("verifyNoteFieldIsAbsent", () => this.expectToHaveCount(noteAskFieldTestIds.root, 0));

  openFromMenu = () =>
    this.step("openFromMenu", async () => {
      await this.click(overviewActionsMenuTestIds.trigger);
      await this.click(overviewActionsMenuTestIds.chatItem);
    });

  verifyMenuOffersChat = (offered: boolean) =>
    this.step(`verifyMenuOffersChat ${offered}`, async () => {
      await this.click(overviewActionsMenuTestIds.trigger);
      await this.expectToHaveCount(overviewActionsMenuTestIds.chatItem, offered ? 1 : 0);
      await this.page.keyboard.press("Escape");
    });

  verifyIsOpen = (open: boolean) =>
    this.step(`verifyIsOpen ${open}`, () => (open ? expect(this.panel()).toBeVisible() : expect(this.panel()).toHaveCount(0)));

  verifyTitleReads = (title: string) =>
    this.step(`verifyTitleReads ${title}`, () => expect(this.panel().getByTestId(chatPanelTestIds.title)).toHaveText(title));

  verifyEmptyReads = (text: string) =>
    this.step(`verifyEmptyReads ${text}`, () => expect(this.panel().getByTestId(chatPanelTestIds.empty)).toHaveText(text));

  verifyFieldIsFocused = () => this.step("verifyFieldIsFocused", () => expect(this.field()).toBeFocused());

  verifySuggestionsRead = (questions: string[]) =>
    this.step(`verifySuggestionsRead ${questions.join(" | ")}`, async () => {
      if (questions.length === 0) {
        await expect(this.panel().getByTestId(chatPanelTestIds.suggestions)).toHaveCount(0);
      } else {
        await expect(this.panel().getByTestId(chatPanelTestIds.suggestion)).toHaveText(questions);
      }
    });

  clickSuggestion = (index: number) =>
    this.step(`clickSuggestion ${index}`, () => this.click(this.panel().getByTestId(chatPanelTestIds.suggestion).nth(index)));

  type = (text: string) => this.step(`type ${text}`, () => this.field().fill(text));

  ask = (question: string) =>
    this.step(`ask ${question}`, async () => {
      await this.field().fill(question);
      await this.field().press("Enter");
    });

  verifyQuestionsRead = (questions: string[]) =>
    this.step(`verifyQuestionsRead ${questions.join(" | ")}`, () =>
      expect(this.panel().getByTestId(chatPanelTestIds.question)).toHaveText(questions),
    );

  verifyWriting = () =>
    this.step("verifyWriting", async () => {
      await expect(this.panel().getByTestId(chatPanelTestIds.dots)).toBeVisible();
      await expect(this.panel().getByTestId(chatFieldTestIds.stop)).toBeVisible();
      await expect(this.panel().getByTestId(chatPanelTestIds.announcement)).toHaveText("Writing an answer");
    });

  stop = () => this.step("stop", () => this.click(this.panel().getByTestId(chatFieldTestIds.stop)));

  verifyStopped = () =>
    this.step("verifyStopped", async () => {
      await expect(this.panel().getByTestId(chatPanelTestIds.stopped)).toHaveText("Stopped. This one didn’t count.");
      await expect(this.panel().getByTestId(chatFieldTestIds.send)).toBeVisible();
    });

  verifyAnswersRead = (answers: string[]) =>
    this.step(`verifyAnswersRead ${answers.join(" | ")}`, () =>
      expect(this.answers().getByTestId(chatAnswerTestIds.text)).toHaveText(answers),
    );

  verifyNotInSource = (index: number, label: string) =>
    this.step(`verifyNotInSource ${index} ${label}`, () =>
      expect(this.answers().nth(index).getByTestId(chatAnswerTestIds.notInSource)).toHaveText(label),
    );

  verifyCitationsRead = (index: number, names: string[]) =>
    this.step(`verifyCitationsRead ${index} ${names.join(" | ")}`, async () => {
      const pills = this.answers().nth(index).getByTestId(chatCitationPillTestIds.pill);
      await expect(pills).toHaveCount(names.length);
      for (const [at, name] of names.entries()) {
        await expect(pills.nth(at)).toHaveAccessibleName(name);
      }
    });

  followCitation = (answer: number, citation: number) =>
    this.step(`followCitation ${answer} ${citation}`, () =>
      this.click(this.answers().nth(answer).getByTestId(chatCitationPillTestIds.pill).nth(citation)),
    );

  // The whole row under an answer, overview pills then video pills, by their visible words (319c).
  verifyCitationRowReads = (index: number, texts: string[]) =>
    this.step(`verifyCitationRowReads ${index} ${texts.join(" | ")}`, () =>
      expect(this.answers().nth(index).getByTestId(chatAnswerTestIds.citations).locator(":scope > *")).toHaveText(texts),
    );

  verifyOverviewCitationsNamed = (index: number, names: string[]) =>
    this.step(`verifyOverviewCitationsNamed ${index} ${names.join(" | ")}`, async () => {
      const pills = this.answers().nth(index).getByTestId(chatOverviewCitationTestIds.pill);
      await expect(pills).toHaveCount(names.length);
      for (const [at, name] of names.entries()) {
        await expect(pills.nth(at)).toHaveAccessibleName(name);
      }
    });

  // An article's key point or chapter pill has a link to its place on the page beside it (OV-320).
  verifyShowOnPageLinks = (index: number, hrefs: string[]) =>
    this.step(`verifyShowOnPageLinks ${index} ${hrefs.join(" | ")}`, async () => {
      const links = this.answers().nth(index).getByTestId(chatAnswerTestIds.showOnPage);
      await expect(links).toHaveCount(hrefs.length);
      for (const [at, href] of hrefs.entries()) {
        await expect(links.nth(at)).toHaveAttribute("href", href);
      }
    });

  // A decline on an article or a recipe page offers the page itself.
  verifyReadOnPageLinksTo = (index: number, href: string | null) =>
    this.step(`verifyReadOnPageLinksTo ${index} ${href}`, () =>
      href === null
        ? expect(this.answers().nth(index).getByTestId(chatAnswerTestIds.readOnPage)).toHaveCount(0)
        : expect(this.answers().nth(index).getByTestId(chatAnswerTestIds.readOnPage)).toHaveAttribute("href", href),
    );

  followSettingsLink = (index: number): Promise<SettingsPageObject> =>
    this.step(`followSettingsLink ${index}`, async () => {
      await this.answers().nth(index).getByTestId(chatAnswerTestIds.settingsLink).click();
      return new SettingsPageObject(this.testContext).verifyIsShown();
    });

  verifyNoteFieldAsks = (placeholder: string) =>
    this.step(`verifyNoteFieldAsks ${placeholder}`, () =>
      expect(this.get(noteAskFieldTestIds.root).getByTestId(chatFieldTestIds.input)).toHaveAttribute("placeholder", placeholder),
    );

  verifyNoNotInSource = (index: number) =>
    this.step(`verifyNoNotInSource ${index}`, () =>
      expect(this.answers().nth(index).getByTestId(chatAnswerTestIds.notInSource)).toHaveCount(0),
    );

  followOverviewCitation = (answer: number, citation: number) =>
    this.step(`followOverviewCitation ${answer} ${citation}`, () =>
      this.click(this.answers().nth(answer).getByTestId(chatOverviewCitationTestIds.pill).nth(citation)),
    );

  verifyOverviewCitationIsFocused = (answer: number, citation: number) =>
    this.step(`verifyOverviewCitationIsFocused ${answer} ${citation}`, () =>
      expect(this.answers().nth(answer).getByTestId(chatOverviewCitationTestIds.pill).nth(citation)).toBeFocused(),
    );

  // Another of the reader's overviews an answer drew on (OV-355).
  verifyOtherOverviewCitationsNamed = (index: number, names: string[]) =>
    this.step(`verifyOtherOverviewCitationsNamed ${index} ${names.join(" | ")}`, async () => {
      const links = this.answers().nth(index).getByTestId(chatOtherOverviewCitationTestIds.link);
      await expect(links).toHaveCount(names.length);
      for (const [at, name] of names.entries()) {
        await expect(links.nth(at)).toHaveAccessibleName(name);
      }
    });

  followOtherOverviewCitation = (answer: number, citation: number) =>
    this.step(`followOtherOverviewCitation ${answer} ${citation}`, () =>
      this.click(this.answers().nth(answer).getByTestId(chatOtherOverviewCitationTestIds.link).nth(citation)),
    );

  verifyDeletedOtherOverviewReads = (answer: number, text: string) =>
    this.step(`verifyDeletedOtherOverviewReads ${answer} ${text}`, async () => {
      const gone = this.answers().nth(answer).getByTestId(chatOtherOverviewCitationTestIds.gone);
      await expect(gone).toHaveText(text);
      await expect(gone.getByRole("link")).toHaveCount(0);
    });

  verifyGoneCitationReads = (answer: number, text: string) =>
    this.step(`verifyGoneCitationReads ${answer} ${text}`, async () => {
      const gone = this.answers().nth(answer).getByTestId(chatOverviewCitationTestIds.gone);
      await expect(gone).toHaveText(text);
      await expect(gone.getByRole("button")).toHaveCount(0);
    });

  // The part of the note a citation led to: tinted, focused, and the only one (319n).
  verifyOverviewPartCited = (text: string) =>
    this.step(`verifyOverviewPartCited ${text}`, async () => {
      const cited = this.page.locator('[data-cited-part="true"]');
      await expect(cited.first()).toContainText(text);
      await expect(cited.first()).toBeFocused();
      await expect(cited.first()).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(this.page.getByTestId(readerPageTestIds.citedSaid)).not.toBeEmpty();
    });

  verifyCitedSaid = (text: string) =>
    this.step(`verifyCitedSaid ${text}`, () => expect(this.page.getByTestId(readerPageTestIds.citedSaid)).toHaveText(text));

  verifyCitationMenuOffers = (watchName: string) =>
    this.step(`verifyCitationMenuOffers ${watchName}`, async () => {
      const menu = this.panel().getByTestId(chatCitationPillTestIds.menu);
      await expect(menu.getByTestId(chatCitationPillTestIds.watchLink)).toHaveAccessibleName(watchName);
      await expect(menu.getByTestId(chatCitationPillTestIds.watchLink)).toBeFocused();
      await expect(menu.getByTestId(chatCitationPillTestIds.transcriptButton)).toBeVisible();
    });

  readCitedInTranscript = () =>
    this.step("readCitedInTranscript", () => this.click(this.panel().getByTestId(chatCitationPillTestIds.transcriptButton)));

  verifyNoteLineCited = (text: string) =>
    this.step(`verifyNoteLineCited ${text}`, async () => {
      const cited = this.page.locator(`[data-testid="${readAlongNoteTestIds.line}"][data-cited="true"]`);
      await expect(cited).toHaveCount(1);
      await expect(cited).toContainText(text);
    });

  verifyCopyUnderAnswers = (count: number) =>
    this.step(`verifyCopyUnderAnswers ${count}`, async () => {
      await expect(this.answers()).toHaveCount(count);
      for (let index = 0; index < count; index++) {
        await expect(this.answers().nth(index).getByTestId(chatAnswerActionsTestIds.copy)).toHaveAccessibleName("Copy answer");
      }
    });

  verifyCopyIsShown = (index: number, shown: boolean) =>
    this.step(`verifyCopyIsShown ${index} ${shown}`, () =>
      expect(this.answers().nth(index).getByTestId(chatAnswerActionsTestIds.root)).toHaveCSS("opacity", shown ? "1" : "0"),
    );

  hoverAnswer = (index: number) => this.step(`hoverAnswer ${index}`, () => this.answers().nth(index).hover());

  verifyMenuIsOffered = (offered: boolean) =>
    this.step(`verifyMenuIsOffered ${offered}`, () =>
      expect(this.panel().getByTestId(chatConversationMenuTestIds.trigger)).toHaveCount(offered ? 1 : 0),
    );

  private openMenuIfClosed = async () => {
    if ((await this.page.getByTestId(chatConversationMenuTestIds.menu).count()) === 0) {
      await this.click(this.panel().getByTestId(chatConversationMenuTestIds.trigger));
    }
  };

  openMenu = () => this.step("openMenu", () => this.click(this.panel().getByTestId(chatConversationMenuTestIds.trigger)));

  verifyMenuOffers = (items: string[]) =>
    this.step(`verifyMenuOffers ${items.join(" | ")}`, async () => {
      const offered = this.page.getByTestId(chatConversationMenuTestIds.menu).getByRole("menuitem");
      await expect(offered).toHaveCount(items.length);
      for (const [index, name] of items.entries()) {
        await expect(offered.nth(index)).toHaveAccessibleName(name);
      }
    });

  verifyContinueDetailReads = (detail: string) =>
    this.step(`verifyContinueDetailReads ${detail}`, () =>
      expect(this.page.getByTestId(chatConversationMenuTestIds.continueDetail)).toHaveText(detail),
    );

  verifyMenuIsInASheet = () =>
    this.step("verifyMenuIsInASheet", () => expect(this.page.getByTestId(chatConversationMenuTestIds.sheet)).toBeVisible());

  verifyMenuIsClosed = () =>
    this.step("verifyMenuIsClosed", async () => {
      await expect(this.page.getByTestId(chatConversationMenuTestIds.menu)).toHaveCount(0);
      await expect(this.panel().getByTestId(chatConversationMenuTestIds.trigger)).toBeFocused();
    });

  continueIn = () =>
    this.step("continueIn", async () => {
      await this.openMenuIfClosed();
      await this.click(this.page.getByTestId(chatConversationMenuTestIds.continueIn));
    });

  verifyAnnounced = (text: string) =>
    this.step(`verifyAnnounced ${text}`, () => expect(this.panel().getByTestId(chatPanelTestIds.announcement)).toHaveText(text));

  verifyFailureReads = (text: string) =>
    this.step(`verifyFailureReads ${text}`, () => expect(this.panel().getByTestId(chatPanelTestIds.failure)).toContainText(text));

  tryAgain = () => this.step("tryAgain", () => this.click(this.panel().getByTestId(chatPanelTestIds.tryAgain)));

  newConversation = () => this.step("newConversation", () => this.click(this.panel().getByTestId(chatPanelTestIds.newConversation)));

  close = () => this.step("close", () => this.click(this.panel().getByTestId(chatPanelTestIds.close)));

  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));

  openList = () =>
    this.step("openList", async () => {
      await this.openMenuIfClosed();
      await this.click(this.page.getByTestId(chatConversationMenuTestIds.conversations));
    });

  openListFromNote = () => this.step("openListFromNote", () => this.click(noteAskFieldTestIds.conversations));

  verifyNoteLinkReads = (text: string) =>
    this.step(`verifyNoteLinkReads ${text}`, () => expect(this.get(noteAskFieldTestIds.conversations)).toHaveText(text));

  verifyAboutReads = (text: string) =>
    this.step(`verifyAboutReads ${text}`, () => expect(this.panel().getByTestId(chatPanelTestIds.about)).toHaveText(text));

  verifyConversationsRead = (rows: Array<{ title: string; meta: string }>) =>
    this.step(`verifyConversationsRead ${rows.map(({ title }) => title).join(" | ")}`, async () => {
      const list = this.panel().getByTestId(chatConversationListTestIds.row);
      await expect(list).toHaveCount(rows.length);
      for (const [index, { title, meta }] of rows.entries()) {
        await expect(list.nth(index).getByTestId(chatConversationListTestIds.open)).toContainText(title);
        await expect(list.nth(index).getByTestId(chatConversationListTestIds.meta)).toHaveText(meta);
      }
    });

  openConversationRow = (index: number) =>
    this.step(`openConversationRow ${index}`, () => this.click(this.panel().getByTestId(chatConversationListTestIds.open).nth(index)));

  deleteConversationRow = (index: number, name: string) =>
    this.step(`deleteConversationRow ${index}`, async () => {
      const button = this.panel().getByTestId(chatConversationListTestIds.delete).nth(index);
      await expect(button).toHaveAccessibleName(name);
      await this.click(button);
    });

  verifyToastReads = (text: string | null) =>
    this.step(`verifyToastReads ${text}`, () =>
      text === null
        ? expect(this.panel().getByTestId(chatPanelTestIds.toast)).toHaveCount(0)
        : expect(this.panel().getByTestId(chatPanelTestIds.toast)).toHaveText(text),
    );

  undo = () => this.step("undo", () => this.click(this.panel().getByTestId(chatPanelTestIds.undo)));

  verifyConversationCitation = (answer: number, name: string) =>
    this.step(`verifyConversationCitation ${answer} ${name}`, () =>
      expect(this.answers().nth(answer).getByTestId(chatAnswerTestIds.conversation)).toHaveAccessibleName(name),
    );

  followConversationCitation = (answer: number) =>
    this.step(`followConversationCitation ${answer}`, () =>
      this.click(this.answers().nth(answer).getByTestId(chatAnswerTestIds.conversation)),
    );

  verifyDeletedConversationCited = (answer: number) =>
    this.step(`verifyDeletedConversationCited ${answer}`, async () => {
      await expect(this.answers().nth(answer).getByTestId(chatAnswerTestIds.deletedConversation)).toHaveText(
        "From a conversation you deleted",
      );
      await expect(this.answers().nth(answer).getByTestId(chatAnswerTestIds.conversation)).toHaveCount(0);
    });

  verifyQuestionFocused = (text: string) =>
    this.step(`verifyQuestionFocused ${text}`, () =>
      expect(this.panel().getByTestId(chatPanelTestIds.question).filter({ hasText: text })).toBeFocused(),
    );

  verifyBackReads = (text: string) =>
    this.step(`verifyBackReads ${text}`, () => expect(this.panel().getByTestId(chatPanelTestIds.back)).toHaveText(text));

  goBack = () => this.step("goBack", () => this.click(this.panel().getByTestId(chatPanelTestIds.back)));

  verifyWaitReads = (heading: string, body: string, action: string | null) =>
    this.step(`verifyWaitReads ${heading}`, async () => {
      const wait = this.panel().getByTestId(chatWaitBlockTestIds.root);
      await expect(wait).toHaveRole("status");
      await expect(wait.getByTestId(chatWaitBlockTestIds.heading)).toHaveText(heading);
      await expect(wait.getByTestId(chatWaitBlockTestIds.body)).toHaveText(body);
      if (action === null) {
        await expect(wait.getByTestId(chatWaitBlockTestIds.action)).toHaveCount(0);
      } else {
        await expect(wait.getByTestId(chatWaitBlockTestIds.action)).toHaveText(action);
      }
      await expect(this.field()).toHaveCount(0);
      await expect(this.panel().getByTestId(chatPanelTestIds.suggestions)).toHaveCount(0);
    });

  verifyNoWait = () =>
    this.step("verifyNoWait", async () => {
      await expect(this.panel().getByTestId(chatWaitBlockTestIds.root)).toHaveCount(0);
      await expect(this.field()).toBeVisible();
    });

  clickWaitAction = () => this.step("clickWaitAction", () => this.click(this.panel().getByTestId(chatWaitBlockTestIds.action)));

  verifyLeftReads = (text: string | null) =>
    this.step(`verifyLeftReads ${text}`, () =>
      text === null
        ? expect(this.panel().getByTestId(chatPanelTestIds.left)).toHaveCount(0)
        : expect(this.panel().getByTestId(chatPanelTestIds.left)).toHaveText(text),
    );

  verifySlowReads = (text: string) =>
    this.step(`verifySlowReads ${text}`, () => expect(this.panel().getByTestId(chatPanelTestIds.slow)).toHaveText(text));

  verifySheetIs = (rest: "raised" | "lowered") =>
    this.step(`verifySheetIs ${rest}`, async () => {
      const sheet = this.page.getByTestId(chatSheetTestIds.root);
      await expect(sheet).toHaveAttribute("data-rest", rest);
      await expect(sheet).toHaveAttribute("aria-modal", rest === "raised" ? "true" : "false");
      await expect(this.page.getByTestId(chatSheetTestIds.grab)).toHaveAccessibleName(rest === "raised" ? "Lower chat" : "Raise chat");
    });

  clickHandle = () => this.step("clickHandle", () => this.click(chatSheetTestIds.grab));

  dragHandle = (byPx: number, steps: number) =>
    this.step(`dragHandle ${byPx}`, async () => {
      const grab = this.page.getByTestId(chatSheetTestIds.grab);
      let box = (await grab.boundingBox())!;
      for (let tries = 0; tries < 20; tries += 1) {
        await this.page.waitForTimeout(100);
        const settled = (await grab.boundingBox())!;
        if (settled.y === box.y) {
          break;
        }
        box = settled;
      }
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await this.page.mouse.move(x, y);
      await this.page.mouse.down();
      await this.page.mouse.move(x, y + byPx, { steps });
      await this.page.mouse.up();
    });

  verifyLoweredReads = (title: string, line: string, raiseName: string) =>
    this.step(`verifyLoweredReads ${line}`, async () => {
      const lowered = this.page.getByTestId(chatSheetTestIds.lowered);
      await expect(lowered).toContainText(title);
      await expect(this.page.getByTestId(chatSheetTestIds.loweredLine)).toHaveText(line);
      await expect(this.page.getByTestId(chatSheetTestIds.raise)).toHaveAccessibleName(raiseName);
    });

  raiseFromLowered = () => this.step("raiseFromLowered", () => this.click(chatSheetTestIds.raise));

  pressF6 = () => this.step("pressF6", () => this.page.keyboard.press("F6"));

  // OV-354: the "@" picker, the row above the field and what each question drew on.
  openPickerWithButton = () => this.step("openPickerWithButton", () => this.click(this.panel().getByTestId(chatFieldTestIds.at)));

  verifyPickerOffers = (titles: string[]) =>
    this.step(`verifyPickerOffers ${titles.join(" | ")}`, () =>
      expect(this.panel().getByTestId(chatComposerTestIds.option).locator("b")).toHaveText(titles),
    );

  verifyPickerDetailsRead = (details: string[]) =>
    this.step(`verifyPickerDetailsRead ${details.join(" | ")}`, () =>
      expect(this.panel().getByTestId(chatComposerTestIds.option).locator("small")).toHaveText(details),
    );

  verifyPickerLineReads = (text: string) =>
    this.step(`verifyPickerLineReads ${text}`, () => expect(this.panel().getByTestId(chatComposerTestIds.pickerLine)).toHaveText(text));

  verifyPickerIsOpen = (open: boolean) =>
    this.step(`verifyPickerIsOpen ${open}`, () => expect(this.panel().getByTestId(chatComposerTestIds.picker)).toHaveCount(open ? 1 : 0));

  pressInField = (key: string) => this.step(`pressInField ${key}`, () => this.field().press(key));

  choosePickerOption = (index: number) =>
    this.step(`choosePickerOption ${index}`, () => this.click(this.panel().getByTestId(chatComposerTestIds.option).nth(index)));

  verifyFieldReads = (text: string) => this.step(`verifyFieldReads ${text}`, () => expect(this.field()).toHaveValue(text));

  verifyNextSourcesRead = (texts: string[]) =>
    this.step(`verifyNextSourcesRead ${texts.join(" | ")}`, async () => {
      const row = this.panel().getByTestId(chatComposerTestIds.sources);
      if (texts.length === 0) {
        return expect(row).toHaveCount(0);
      }
      await expect(row.locator(":scope > *")).toHaveText(texts);
    });

  removeNextSource = (index: number) =>
    this.step(`removeNextSource ${index}`, () =>
      this.click(this.panel().getByTestId(chatComposerTestIds.sources).getByTestId(chatSourceChipTestIds.remove).nth(index)),
    );

  openMoreSources = () => this.step("openMoreSources", () => this.click(this.panel().getByTestId(chatComposerTestIds.more)));

  verifyMoreSourcesRead = (titles: string[]) =>
    this.step(`verifyMoreSourcesRead ${titles.join(" | ")}`, async () => {
      const removes = this.panel().getByTestId(chatComposerTestIds.moreMenu).getByTestId(chatComposerTestIds.moreRemove);
      await expect(removes).toHaveCount(titles.length);
      for (const [at, title] of titles.entries()) {
        await expect(removes.nth(at)).toHaveAccessibleName(`Remove source: ${title}`);
      }
    });

  clearAllSources = () => this.step("clearAllSources", () => this.click(this.panel().getByTestId(chatComposerTestIds.clearAll)));

  verifyDrewOn = (how: "pinned" | "found", question: number, titles: string[] | null) =>
    this.step(`verifyDrewOn ${how} ${question} ${titles?.join(" | ") ?? "none"}`, async () => {
      const question_ = this.panel().getByTestId(chatPanelTestIds.question).nth(question);
      const row = question_.locator(
        how === "pinned"
          ? `xpath=preceding-sibling::li[1][@data-testid="${chatDrewOnTestIds.pinned}"]`
          : `xpath=following-sibling::li[1][@data-testid="${chatDrewOnTestIds.found}"]`,
      );
      if (titles === null) {
        return expect(row).toHaveCount(0);
      }
      await expect(row.getByTestId(chatSourceChipTestIds.chip)).toHaveText(titles);
      await expect(row.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
    });

  // OV-362: past two chips the row folds into "+N", whose menu lists every one.
  // OV-364: an answer's inline code, links and code blocks, the same in every chat.
  verifyMarkdownRead = (answer: number, { code, links, blocks }: { code: string[]; links: string[]; blocks: string[] }) =>
    this.step(`verifyMarkdownRead ${answer}`, async () => {
      const root = this.answers().nth(answer);
      await expect(root.locator("p code")).toHaveText(code);
      await expect(root.getByTestId(chatMarkedTextTestIds.link)).toHaveText(links.map((link) => `${link} (opens in a new tab)`));
      for (const link of await root.getByTestId(chatMarkedTextTestIds.link).all()) {
        await expect(link).toHaveAttribute("target", "_blank");
      }
      await expect(root.getByTestId(chatCodeBlockTestIds.code)).toHaveText(blocks);
      await expect(root).not.toContainText("```");
      await expect(root).not.toContainText("`");
    });

  verifyCodeBlocksInListItems = (answer: number, count: number) =>
    this.step(`verifyCodeBlocksInListItems ${answer} ${count}`, () =>
      expect(this.answers().nth(answer).locator("li").getByTestId(chatCodeBlockTestIds.code)).toHaveCount(count),
    );

  copyCodeBlock = (answer: number, index: number, expected: string) =>
    this.step(`copyCodeBlock ${answer} ${index}`, async () => {
      await this.page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      const copy = this.answers().nth(answer).getByTestId(chatCodeBlockTestIds.copy).nth(index);
      await copy.click();
      await expect(copy).toHaveAccessibleName("Code copied");
      expect(await this.page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
    });

  verifyBoldRead = (answer: number, texts: string[]) =>
    this.step(`verifyBoldRead ${answer} ${texts.join(" | ")}`, async () => {
      await expect(this.answers().nth(answer).locator("strong")).toHaveText(texts);
      await expect(this.answers().nth(answer)).not.toContainText("**");
    });

  verifyDrewOnFolds = (how: "pinned" | "found", question: number, shown: string[], hidden: string[]) =>
    this.step(`verifyDrewOnFolds ${how} ${question}`, async () => {
      const row = this.panel()
        .getByTestId(how === "pinned" ? chatDrewOnTestIds.pinned : chatDrewOnTestIds.found)
        .nth(question)
        .getByTestId(chatChipRowTestIds.root);
      await expect(row.getByTestId(chatSourceChipTestIds.chip)).toHaveText(shown);
      const more = row.getByTestId(chatChipRowTestIds.more);
      await expect(more).toHaveText(`+${hidden.length}`);
      await expect(more).toHaveAccessibleName(`${hidden.length} more: ${hidden.join(", ")}`);
      await more.click();
      await expect(row.getByTestId(chatChipRowTestIds.menu).getByTestId(chatSourceChipTestIds.chip)).toHaveText([...shown, ...hidden]);
    });

  followDrewOn = (how: "pinned" | "found", index: number) =>
    this.step(`followDrewOn ${how} ${index}`, () =>
      this.click(
        this.panel()
          .getByTestId(how === "pinned" ? chatDrewOnTestIds.pinned : chatDrewOnTestIds.found)
          .getByRole("link")
          .nth(index),
      ),
    );

  verifySearchLibraryIs = (on: boolean) =>
    this.step(`verifySearchLibraryIs ${on}`, async () => {
      await this.openMenuIfClosed();
      const item = this.page.getByTestId(chatConversationMenuTestIds.searchLibrary);
      await expect(item).toHaveAttribute("aria-checked", String(on));
      await expect(item).toContainText(
        on ? "On: up to 3 close overviews are read with each question" : "Off: only what you pin with “@” is read",
      );
    });

  switchSearchLibrary = () =>
    this.step("switchSearchLibrary", async () => {
      await this.openMenuIfClosed();
      await this.click(this.page.getByTestId(chatConversationMenuTestIds.searchLibrary));
    });

  verifySectionsRead = (answer: number, headings: string[]) =>
    this.step(`verifySectionsRead ${answer} ${headings.join(" | ")}`, () =>
      expect(
        this.answers()
          .nth(answer)
          .locator(`[data-testid="${chatAnswerTestIds.section}"] h3, [data-testid="${chatAnswerTestIds.takeaway}"] h3`),
      ).toHaveText(headings),
    );

  verifySectionSourcesRead = (answer: number, section: number, groups: string[]) =>
    this.step(`verifySectionSourcesRead ${answer} ${section} ${groups.join(" | ")}`, () =>
      expect(
        this.answers()
          .nth(answer)
          .getByTestId(chatAnswerTestIds.section)
          .nth(section)
          .getByTestId(chatAnswerTestIds.sectionSources)
          .locator(":scope > *"),
      ).toHaveText(groups),
    );

  verifyNoCitationRow = (answer: number) =>
    this.step(`verifyNoCitationRow ${answer}`, () =>
      expect(this.answers().nth(answer).getByTestId(chatAnswerTestIds.citations)).toHaveCount(0),
    );

  openSourcesMenu = (answer: number) =>
    this.step(`openSourcesMenu ${answer}`, async () => {
      await this.answers().nth(answer).hover();
      await this.click(this.answers().nth(answer).getByTestId(chatAnswerTestIds.sources));
    });

  verifySourcesMenuReads = (answer: number, count: number, texts: string[]) =>
    this.step(`verifySourcesMenuReads ${answer} ${count}`, async () => {
      await expect(this.answers().nth(answer).getByTestId(chatAnswerTestIds.sources)).toHaveText(`Sources ${count}`);
      await expect(this.answers().nth(answer).getByTestId(chatAnswerTestIds.sourcesMenu).locator(":scope > *")).toHaveText(texts);
    });

  verifyNoteIsFocused = () => this.step("verifyNoteIsFocused", () => expect(this.page.getByRole("tabpanel")).toBeFocused());
}
