import { expect } from "@playwright/experimental-ct-react";
import { followUpQuestionsTestIds } from "../../src/features/reader/components/FollowUpQuestions/FollowUpQuestionsTestIds.js";
import { toastTestIds } from "../../src/components/shared/Toast/ToastTestIds.js";
import { followUpAssistantMenuTestIds } from "../../src/features/reader/components/FollowUpAssistantMenu/FollowUpAssistantMenuTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

// Questions to ask next, last in the note, each taken to the reader's own assistant (OV-266).
export class FollowUpQuestionsPageObject extends PageObject {
  private questions = () => this.get(followUpQuestionsTestIds.question);
  private menu = () => this.page.getByTestId(followUpAssistantMenuTestIds.root);

  verifyIsNotShown = () => this.step("verifyIsNotShown", () => this.expectToHaveCount(followUpQuestionsTestIds.root, 0));

  verifyIsLastInTheNote = () =>
    this.step("verifyIsLastInTheNote", async () => {
      const root = this.get(followUpQuestionsTestIds.root);
      await expect(root).toBeVisible();
      await expect(root.getByText("Questions to ask next", { exact: true })).toBeVisible();
    });

  verifyQuestionsRead = (questions: string[]) =>
    this.step(`verifyQuestionsRead ${questions.join(" | ")}`, () => expect(this.questions()).toHaveText(questions));

  verifyLineReads = (line: string) =>
    this.step(`verifyLineReads ${line}`, () => expect(this.get(followUpQuestionsTestIds.line)).toHaveText(line));

  verifyQuestionNamed = (index: number, name: string) =>
    this.step(`verifyQuestionNamed ${index} ${name}`, () => expect(this.questions().nth(index)).toHaveAccessibleName(name));

  clickQuestion = (index: number) => this.step(`clickQuestion ${index}`, () => this.click(this.questions().nth(index)));

  verifyDifferentQuestionsIs = (name: string | null) =>
    this.step(`verifyDifferentQuestionsIs ${name}`, async () => {
      if (name === null) {
        await this.expectToHaveCount(followUpQuestionsTestIds.different, 0);
        return;
      }
      await expect(this.get(followUpQuestionsTestIds.different)).toHaveAccessibleName(name);
    });

  clickDifferentQuestions = () => this.step("clickDifferentQuestions", () => this.click(followUpQuestionsTestIds.different));

  verifyDifferentQuestionsIsFocused = () =>
    this.step("verifyDifferentQuestionsIsFocused", () => expect(this.get(followUpQuestionsTestIds.different)).toBeFocused());

  verifyAnnounced = (said: string) =>
    this.step(`verifyAnnounced ${said}`, () => expect(this.get(followUpQuestionsTestIds.said)).toHaveText(said));

  verifyToastReads = (text: string) =>
    this.step(`verifyToastReads ${text}`, () => expect(this.page.getByTestId(toastTestIds.root)).toHaveText(text));

  clickChange = () => this.step("clickChange", () => this.click(followUpQuestionsTestIds.change));

  verifyMenuIs = (title: string | null) =>
    this.step(`verifyMenuIs ${title}`, async () => {
      if (title === null) {
        await expect(this.menu()).toHaveCount(0);
        return;
      }
      await expect(this.menu()).toBeVisible();
      await expect(this.menu().getByText(title, { exact: true })).toBeVisible();
    });

  verifyMenuOffersSetUp = (offered: boolean) =>
    this.step(`verifyMenuOffersSetUp ${offered}`, () =>
      expect(this.page.getByTestId(followUpAssistantMenuTestIds.setUpNote)).toHaveCount(offered ? 1 : 0),
    );

  verifyMenuOffersCopy = (offered: boolean) =>
    this.step(`verifyMenuOffersCopy ${offered}`, () =>
      expect(this.page.getByTestId(followUpAssistantMenuTestIds.copyQuestion)).toHaveCount(offered ? 1 : 0),
    );

  verifyOptionFocused = (assistant: string) =>
    this.step(`verifyOptionFocused ${assistant}`, () =>
      expect(this.page.getByTestId(followUpAssistantMenuTestIds.option(assistant))).toBeFocused(),
    );

  chooseAssistant = (assistant: string) =>
    this.step(`chooseAssistant ${assistant}`, () => this.page.getByTestId(followUpAssistantMenuTestIds.option(assistant)).click());

  clickCopyQuestion = () => this.step("clickCopyQuestion", () => this.page.getByTestId(followUpAssistantMenuTestIds.copyQuestion).click());

  followSetUpConnection = () =>
    this.step("followSetUpConnection", () => this.page.getByTestId(followUpAssistantMenuTestIds.setUpLink).click());

  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));

  // A tab the app opens is noted rather than loaded, so a test never reaches a real assistant.
  catchNewTabs = () =>
    this.step("catchNewTabs", () =>
      this.page.evaluate(() => {
        const opened: string[] = [];
        (window as unknown as { openedTabs: string[] }).openedTabs = opened;
        window.open = (url) => {
          opened.push(String(url));
          return null;
        };
      }),
    );

  newTabs = (): Promise<URL[]> =>
    this.page.evaluate(() => (window as unknown as { openedTabs: string[] }).openedTabs).then((urls) => urls.map((url) => new URL(url)));

  verifyReceiptsRead = (receipts: string[]) =>
    this.step(`verifyReceiptsRead ${receipts.join(" | ")}`, () => expect(this.get(followUpQuestionsTestIds.receipt)).toHaveText(receipts));

  verifyQuestionDescribed = (index: number, description: string) =>
    this.step(`verifyQuestionDescribed ${index} ${description}`, () =>
      expect(this.questions().nth(index)).toHaveAccessibleDescription(description),
    );

  verifyQuestionIsFocused = (index: number) =>
    this.step(`verifyQuestionIsFocused ${index}`, () => expect(this.questions().nth(index)).toBeFocused());
}
