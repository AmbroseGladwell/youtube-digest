import { expect } from "@playwright/experimental-ct-react";
import { askPageTestIds } from "../../src/features/chats/AskPage/AskPageTestIds.js";
import { askAnswerTestIds } from "../../src/features/chats/components/AskAnswer/AskAnswerTestIds.js";
import { askDrawerTestIds } from "../../src/features/chats/components/AskDrawer/AskDrawerTestIds.js";
import { askPickingWaitTestIds } from "../../src/features/chats/components/AskPickingWait/AskPickingWaitTestIds.js";
import { chatAnswerTestIds } from "../../src/features/chats/components/ChatAnswer/ChatAnswerTestIds.js";
import { chatComposerTestIds } from "../../src/features/chats/components/ChatComposer/ChatComposerTestIds.js";
import { chatDrewOnTestIds } from "../../src/features/chats/components/ChatDrewOn/ChatDrewOnTestIds.js";
import { chatFieldTestIds } from "../../src/features/chats/components/ChatField/ChatFieldTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

// The Ask page, over the whole library or one project (OV-354, pages 3 and 4; docs/features/chats.md).
export class AskPagePageObject extends PageObject {
  private root = () => this.page.getByTestId(askPageTestIds.root);
  private field = () => this.root().getByTestId(chatFieldTestIds.input);
  private answers = () => this.root().getByTestId(askAnswerTestIds.root);
  private drawer = () => this.page.getByTestId(askDrawerTestIds.root);

  verifyIsShown = (): Promise<AskPagePageObject> =>
    this.step("verifyIsShown", async () => {
      await expect(this.root()).toBeVisible();
      return this;
    });

  verifyHeadingReads = (text: string) =>
    this.step(`verifyHeadingReads ${text}`, () => expect(this.root().getByTestId(askPageTestIds.heading)).toHaveText(text));

  verifyPlaceholderReads = (text: string) =>
    this.step(`verifyPlaceholderReads ${text}`, () => expect(this.field()).toHaveAttribute("placeholder", text));

  verifyScopeChipReads = (text: string | null) =>
    this.step(`verifyScopeChipReads ${text}`, () =>
      text === null
        ? expect(this.root().getByTestId(askPageTestIds.scopeChip)).toHaveCount(0)
        : expect(this.root().getByTestId(askPageTestIds.scopeChip)).toHaveText(text),
    );

  verifyStartersRead = (questions: string[]) =>
    this.step(`verifyStartersRead ${questions.join(" | ")}`, () =>
      expect(this.root().getByTestId(askPageTestIds.starter)).toHaveText(questions),
    );

  chooseStarter = (index: number) =>
    this.step(`chooseStarter ${index}`, () => this.click(this.root().getByTestId(askPageTestIds.starter).nth(index)));

  type = (text: string) => this.step(`type ${text}`, () => this.field().fill(text));

  ask = (question: string) =>
    this.step(`ask ${question}`, async () => {
      await this.field().fill(question);
      await this.field().press("Enter");
    });

  choosePickerOption = (index: number) =>
    this.step(`choosePickerOption ${index}`, () => this.click(this.root().getByTestId(chatComposerTestIds.option).nth(index)));

  verifyQuestionsRead = (questions: string[]) =>
    this.step(`verifyQuestionsRead ${questions.join(" | ")}`, () =>
      expect(this.root().getByTestId(askPageTestIds.question)).toHaveText(questions),
    );

  verifyPinnedRead = (question: number, titles: string[]) =>
    this.step(`verifyPinnedRead ${question} ${titles.join(" | ")}`, () =>
      expect(this.root().getByTestId(chatDrewOnTestIds.pinned).nth(question).locator("a")).toHaveText(titles),
    );

  verifyReadLineReads = (question: number, text: string) =>
    this.step(`verifyReadLineReads ${question} ${text}`, () =>
      expect(this.root().getByTestId(askPickingWaitTestIds.read).nth(question)).toHaveText(text),
    );

  openReadLine = (question: number) =>
    this.step(`openReadLine ${question}`, () => this.click(this.root().getByTestId(askPickingWaitTestIds.read).nth(question)));

  verifyReadChipsRead = (titles: string[]) =>
    this.step(`verifyReadChipsRead ${titles.join(" | ")}`, () =>
      expect(this.root().getByTestId(askPickingWaitTestIds.readChips).locator(":scope > *")).toHaveText(titles),
    );

  followReadChip = (index: number) =>
    this.step(`followReadChip ${index}`, () =>
      this.click(this.root().getByTestId(askPickingWaitTestIds.readChips).locator(":scope > *").nth(index)),
    );

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

  verifyStatsReads = (answer: number, text: string) =>
    this.step(`verifyStatsReads ${answer} ${text}`, () =>
      expect(this.answers().nth(answer).getByTestId(askAnswerTestIds.stats)).toHaveText(text),
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

  verifyAnnouncement = (text: string) =>
    this.step(`verifyAnnouncement ${text}`, () => expect(this.root().getByTestId(askPageTestIds.announcement)).toHaveText(text));

  openDrawer = () =>
    this.step("openDrawer", async () => {
      await this.click(this.root().getByTestId(askPageTestIds.drawerButton));
      await expect(this.drawer()).toBeVisible();
    });

  verifyDrawerIsOpen = (open: boolean) => this.step(`verifyDrawerIsOpen ${open}`, () => expect(this.drawer()).toHaveCount(open ? 1 : 0));

  verifyDrawerIsSheet = (sheet: boolean) =>
    this.step(`verifyDrawerIsSheet ${sheet}`, async () => {
      const box = (await this.drawer().boundingBox())!;
      const viewport = this.page.viewportSize()!;
      if (sheet) {
        expect(Math.round(box.width)).toBe(viewport.width);
        expect(Math.round(box.y + box.height)).toBe(viewport.height);
      } else expect(Math.round(box.width)).toBe(280);
    });

  // Each group as "<label>: <question> · <scope>, …".
  verifyDrawerReads = (groups: string[]) =>
    this.step(`verifyDrawerReads ${groups.join(" | ")}`, () =>
      expect
        .poll(() =>
          this.drawer()
            .getByTestId(askDrawerTestIds.group)
            .evaluateAll(
              (sections, open) =>
                sections.map((section) => {
                  const label = section.querySelector("h2")?.textContent ?? "";
                  const items = [...section.querySelectorAll(`[data-testid="${open}"]`)].map((button) => {
                    const spans = button.querySelectorAll("span");
                    return `${spans[0]?.textContent ?? ""} · ${spans[1]?.textContent ?? ""}`;
                  });
                  return `${label}: ${items.join(", ")}`;
                }),
              askDrawerTestIds.open,
            ),
        )
        .toEqual(groups),
    );

  verifyDrawerEmpty = () => this.step("verifyDrawerEmpty", () => expect(this.drawer().getByTestId(askDrawerTestIds.empty)).toBeVisible());

  openDrawerConversation = (index: number) =>
    this.step(`openDrawerConversation ${index}`, () => this.click(this.drawer().getByTestId(askDrawerTestIds.open).nth(index)));

  newChat = () => this.step("newChat", () => this.click(this.drawer().getByTestId(askDrawerTestIds.newChat)));

  deleteDrawerConversation = (index: number) =>
    this.step(`deleteDrawerConversation ${index}`, async () => {
      await this.drawer().getByTestId(askDrawerTestIds.item).nth(index).hover();
      await this.click(this.drawer().getByTestId(askDrawerTestIds.menuButton).nth(index));
      await this.click(this.drawer().getByTestId(askDrawerTestIds.delete));
    });

  verifyToastReads = (text: string | null) =>
    this.step(`verifyToastReads ${text}`, () =>
      text === null
        ? expect(this.root().getByTestId(askPageTestIds.toast)).toHaveCount(0)
        : expect(this.root().getByTestId(askPageTestIds.toast)).toHaveText(text),
    );

  undo = () => this.step("undo", () => this.click(this.root().getByTestId(askPageTestIds.undo)));
}
