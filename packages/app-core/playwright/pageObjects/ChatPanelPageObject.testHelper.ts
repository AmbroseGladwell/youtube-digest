import { expect } from "@playwright/experimental-ct-react";
import { chatAnswerTestIds } from "../../src/features/chats/components/ChatAnswer/ChatAnswerTestIds.js";
import { chatAnswerActionsTestIds } from "../../src/features/chats/components/ChatAnswerActions/ChatAnswerActionsTestIds.js";
import { chatConversationListTestIds } from "../../src/features/chats/components/ChatConversationList/ChatConversationListTestIds.js";
import { chatWaitBlockTestIds } from "../../src/features/chats/components/ChatWaitBlock/ChatWaitBlockTestIds.js";
import { chatSheetTestIds } from "../../src/features/chats/components/ChatSheet/ChatSheetTestIds.js";
import { chatCitationPillTestIds } from "../../src/features/chats/components/ChatCitationPill/ChatCitationPillTestIds.js";
import { chatFieldTestIds } from "../../src/features/chats/components/ChatField/ChatFieldTestIds.js";
import { chatPanelTestIds } from "../../src/features/chats/components/ChatPanel/ChatPanelTestIds.js";
import { noteAskFieldTestIds } from "../../src/features/chats/components/NoteAskField/NoteAskFieldTestIds.js";
import { overviewActionsMenuTestIds } from "../../src/features/reader/components/OverviewActionsMenu/OverviewActionsMenuTestIds.js";
import { readAlongNoteTestIds } from "../../src/features/reader/components/ReadAlongNote/ReadAlongNoteTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

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
      if (questions.length === 0) await expect(this.panel().getByTestId(chatPanelTestIds.suggestions)).toHaveCount(0);
      else await expect(this.panel().getByTestId(chatPanelTestIds.suggestion)).toHaveText(questions);
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
      for (const [at, name] of names.entries()) await expect(pills.nth(at)).toHaveAccessibleName(name);
    });

  followCitation = (answer: number, citation: number) =>
    this.step(`followCitation ${answer} ${citation}`, () =>
      this.click(this.answers().nth(answer).getByTestId(chatCitationPillTestIds.pill).nth(citation)),
    );

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

  verifyActionsUnderAnswer = (index: number, continueIn: string) =>
    this.step(`verifyActionsUnderAnswer ${index} ${continueIn}`, async () => {
      await expect(this.panel().getByTestId(chatAnswerActionsTestIds.root)).toHaveCount(1);
      const actions = this.answers().nth(index).getByTestId(chatAnswerActionsTestIds.root);
      await expect(actions.getByTestId(chatAnswerActionsTestIds.copy)).toHaveAccessibleName("Copy answer");
      await expect(actions.getByTestId(chatAnswerActionsTestIds.continueIn)).toHaveText(continueIn);
    });

  continueIn = () => this.step("continueIn", () => this.click(this.panel().getByTestId(chatAnswerActionsTestIds.continueIn)));

  verifyAnnounced = (text: string) =>
    this.step(`verifyAnnounced ${text}`, () => expect(this.panel().getByTestId(chatPanelTestIds.announcement)).toHaveText(text));

  verifyFailureReads = (text: string) =>
    this.step(`verifyFailureReads ${text}`, () => expect(this.panel().getByTestId(chatPanelTestIds.failure)).toContainText(text));

  tryAgain = () => this.step("tryAgain", () => this.click(this.panel().getByTestId(chatPanelTestIds.tryAgain)));

  newConversation = () => this.step("newConversation", () => this.click(this.panel().getByTestId(chatPanelTestIds.newConversation)));

  close = () => this.step("close", () => this.click(this.panel().getByTestId(chatPanelTestIds.close)));

  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));

  verifyCountReads = (name: string | null) =>
    this.step(`verifyCountReads ${name}`, () =>
      name === null
        ? expect(this.panel().getByTestId(chatPanelTestIds.count)).toHaveCount(0)
        : expect(this.panel().getByTestId(chatPanelTestIds.count)).toHaveAccessibleName(name),
    );

  openList = () => this.step("openList", () => this.click(this.panel().getByTestId(chatPanelTestIds.count)));

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
      if (action === null) await expect(wait.getByTestId(chatWaitBlockTestIds.action)).toHaveCount(0);
      else await expect(wait.getByTestId(chatWaitBlockTestIds.action)).toHaveText(action);
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
        if (settled.y === box.y) break;
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

  verifyNoteIsFocused = () => this.step("verifyNoteIsFocused", () => expect(this.page.getByRole("tabpanel")).toBeFocused());
}
