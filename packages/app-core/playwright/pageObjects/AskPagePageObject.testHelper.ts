import { expect } from "@playwright/experimental-ct-react";
import { chatCodeBlockTestIds } from "../../src/features/chats/components/ChatCodeBlock/ChatCodeBlockTestIds.js";
import { chatMarkedTextTestIds } from "../../src/features/chats/components/ChatMarkedText/ChatMarkedTextTestIds.js";
import { askPageTestIds } from "../../src/features/chats/AskPage/AskPageTestIds.js";
import { askAnswerTestIds } from "../../src/features/chats/components/AskAnswer/AskAnswerTestIds.js";
import { askDrawerTestIds } from "../../src/features/chats/components/AskDrawer/AskDrawerTestIds.js";
import { askPickingWaitTestIds } from "../../src/features/chats/components/AskPickingWait/AskPickingWaitTestIds.js";
import { chatAnswerTestIds } from "../../src/features/chats/components/ChatAnswer/ChatAnswerTestIds.js";
import { chatComposerTestIds } from "../../src/features/chats/components/ChatComposer/ChatComposerTestIds.js";
import { chatDrewOnTestIds } from "../../src/features/chats/components/ChatDrewOn/ChatDrewOnTestIds.js";
import { chatChipRowTestIds } from "../../src/features/chats/components/ChatChipRow/ChatChipRowTestIds.js";
import { chatFieldTestIds } from "../../src/features/chats/components/ChatField/ChatFieldTestIds.js";
import { cutTextTestIds } from "../../src/components/shared/CutText/CutTextTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { ReaderPageObject } from "./ReaderPageObject.testHelper.js";

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

  verifyBoldRead = (answer: number, texts: string[]) =>
    this.step(`verifyBoldRead ${answer} ${texts.join(" | ")}`, async () => {
      await expect(this.answers().nth(answer).locator("strong")).toHaveText(texts);
      await expect(this.answers().nth(answer)).not.toContainText("**");
    });

  // A section's first relation group: its two chips, then "+N" whose menu lists them all (OV-362).
  verifySectionSourcesFold = (answer: number, section: number, shown: number, more: number, all: number) =>
    this.step(`verifySectionSourcesFold ${answer} ${section}`, async () => {
      const row = this.answers()
        .nth(answer)
        .getByTestId(chatAnswerTestIds.section)
        .nth(section)
        .getByTestId(chatAnswerTestIds.sectionSources)
        .getByTestId(chatChipRowTestIds.root)
        .first();
      await expect(row.getByRole("link")).toHaveCount(shown);
      await expect(row.getByTestId(chatChipRowTestIds.more)).toHaveText(`+${more}`);
      await row.getByTestId(chatChipRowTestIds.more).click();
      await expect(row.getByTestId(chatChipRowTestIds.menu).getByRole("link")).toHaveCount(all);
    });

  verifySectionSourcesMenuInView = (answer: number, section: number) =>
    this.step(`verifySectionSourcesMenuInView ${answer} ${section}`, () =>
      expect(
        this.answers().nth(answer).getByTestId(chatAnswerTestIds.section).nth(section).getByTestId(chatChipRowTestIds.menu).first(),
      ).toBeInViewport({ ratio: 1 }),
    );

  verifyItemSourcesRead = (answer: number, section: number, item: number, titles: string[]) =>
    this.step(`verifyItemSourcesRead ${answer} ${section} ${item}`, () =>
      expect(
        this.answers()
          .nth(answer)
          .getByTestId(chatAnswerTestIds.section)
          .nth(section)
          .locator("li")
          .nth(item)
          .getByTestId(chatAnswerTestIds.itemSources)
          .getByRole("link"),
      ).toHaveText(titles),
    );

  followItemSource = (answer: number, section: number, item: number) =>
    this.step(`followItemSource ${answer} ${section} ${item}`, () =>
      this.click(
        this.answers()
          .nth(answer)
          .getByTestId(chatAnswerTestIds.section)
          .nth(section)
          .locator("li")
          .nth(item)
          .getByTestId(chatAnswerTestIds.itemSources)
          .getByRole("link")
          .first(),
      ),
    );

  verifyLatestQuestionInView = () =>
    this.step("verifyLatestQuestionInView", () => expect(this.root().getByTestId(askPageTestIds.question).last()).toBeInViewport());

  verifyPickerOpensBelowField = () =>
    this.step("verifyPickerOpensBelowField", async () => {
      const picker = (await this.root().getByTestId(chatComposerTestIds.picker).boundingBox())!;
      const field = (await this.field().boundingBox())!;
      expect(picker.y).toBeGreaterThan(field.y);
      await expect(this.root().getByTestId(chatComposerTestIds.picker)).toBeInViewport({ ratio: 1 });
    });

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

  copyCodeBlock = (answer: number, index: number, expected: string) =>
    this.step(`copyCodeBlock ${answer} ${index}`, async () => {
      await this.page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      const copy = this.answers().nth(answer).getByTestId(chatCodeBlockTestIds.copy).nth(index);
      await copy.click();
      await expect(copy).toHaveAccessibleName("Code copied");
      expect(await this.page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
    });

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
      await this.drawer().evaluate((drawer) => Promise.all(drawer.getAnimations().map((animation) => animation.finished)));
    });

  verifyDrawerIsOpen = (open: boolean) => this.step(`verifyDrawerIsOpen ${open}`, () => expect(this.drawer()).toHaveCount(open ? 1 : 0));

  verifyDrawerIsSheet = (sheet: boolean) =>
    this.step(`verifyDrawerIsSheet ${sheet}`, async () => {
      const box = (await this.drawer().boundingBox())!;
      const viewport = this.page.viewportSize()!;
      if (sheet) {
        expect(Math.round(box.width)).toBe(viewport.width);
        expect(Math.round(box.y + box.height)).toBe(viewport.height);
      } else {
        expect(Math.round(box.width)).toBe(280);
      }
    });

  // Each group as "<label>: <question> · <scope>, …".
  verifyDrawerReads = (groups: string[]) =>
    this.step(`verifyDrawerReads ${groups.join(" | ")}`, () =>
      expect
        .poll(() =>
          this.drawer()
            .getByTestId(askDrawerTestIds.group)
            .evaluateAll(
              (sections, ids) => {
                const itemText = (button: Element) => {
                  const question = button.querySelector(`[data-testid="${ids.question}"]`)?.textContent ?? "";
                  const scope = button.querySelector(`[data-testid="${ids.scope}"]`)?.textContent ?? "";
                  return `${question} · ${scope}`;
                };
                return sections.map((section) => {
                  const label = section.querySelector("h2")?.textContent ?? "";
                  const items = [...section.querySelectorAll(`[data-testid="${ids.open}"]`)].map(itemText);
                  return `${label}: ${items.join(", ")}`;
                });
              },
              { open: askDrawerTestIds.open, question: askDrawerTestIds.question, scope: askDrawerTestIds.scope },
            ),
        )
        .toEqual(groups),
    );

  hoverDrawerConversation = (index: number) =>
    this.step(`hoverDrawerConversation ${index}`, () => this.drawer().getByTestId(askDrawerTestIds.question).nth(index).hover());

  // The tip with a cut-off name in full, or none when the name fits (OV-371).
  verifyDrawerTipReads = (index: number, text: string | null) =>
    this.step(`verifyDrawerTipReads ${index} ${text}`, async () => {
      const tip = this.drawer().getByTestId(askDrawerTestIds.item).nth(index).getByTestId(cutTextTestIds.tip);
      if (text === null) {
        await expect(tip).toHaveCount(0);
      } else {
        await expect(tip).toBeVisible();
        await expect(tip).toHaveText(text);
      }
    });

  // A press held past the long-press time, then let go: the tip shows while held (OV-371).
  holdDrawerConversation = (index: number) =>
    this.step(`holdDrawerConversation ${index}`, async () => {
      const question = this.drawer().getByTestId(askDrawerTestIds.question).nth(index);
      await question.dispatchEvent("touchstart");
      await expect(this.drawer().getByTestId(askDrawerTestIds.item).nth(index).getByTestId(cutTextTestIds.tip)).toBeVisible();
      await question.dispatchEvent("touchend");
      await question.dispatchEvent("click");
    });

  scrollDrawerToEnd = () =>
    this.step("scrollDrawerToEnd", () => this.drawer().evaluate((drawer) => drawer.scrollTo({ top: drawer.scrollHeight })));

  // New chat stays at the top of the drawer, with the fade under it once the list has scrolled.
  verifyDrawerTopIsPinned = (scrolled: boolean) =>
    this.step(`verifyDrawerTopIsPinned ${scrolled}`, async () => {
      const drawerBox = (await this.drawer().boundingBox())!;
      const newChat = this.drawer().getByTestId(askDrawerTestIds.newChat);
      await expect(newChat).toBeInViewport({ ratio: 1 });
      const box = (await newChat.boundingBox())!;
      expect(box.y - drawerBox.y).toBeLessThan(80);
      await expect
        .poll(() =>
          this.drawer()
            .getByTestId(askDrawerTestIds.top)
            .evaluate((top) => getComputedStyle(top, "::after").opacity),
        )
        .toBe(scrolled ? "1" : "0");
    });

  verifyDrawerEmpty = () => this.step("verifyDrawerEmpty", () => expect(this.drawer().getByTestId(askDrawerTestIds.empty)).toBeVisible());

  openDrawerConversation = (index: number) =>
    this.step(`openDrawerConversation ${index}`, () => this.click(this.drawer().getByTestId(askDrawerTestIds.open).nth(index)));

  // An overview's conversation opens on that overview, not here (OV-363).
  openDrawerOverviewConversation = (index: number): Promise<ReaderPageObject> =>
    this.step(`openDrawerOverviewConversation ${index}`, async () => {
      await this.click(this.drawer().getByTestId(askDrawerTestIds.open).nth(index));
      return new ReaderPageObject(this.testContext).verifyIsShown();
    });

  closeDrawer = () => this.step("closeDrawer", () => this.click(this.drawer().getByTestId(askDrawerTestIds.close)));

  openDrawerItemMenu = (index: number) =>
    this.step(`openDrawerItemMenu ${index}`, async () => {
      await this.drawer().getByTestId(askDrawerTestIds.item).nth(index).hover();
      await this.click(this.drawer().getByTestId(askDrawerTestIds.menuButton).nth(index));
    });

  verifyDrawerItemMenuIsInView = () =>
    this.step("verifyDrawerItemMenuIsInView", async () => {
      const menu = this.drawer().getByTestId(askDrawerTestIds.menu);
      await expect(menu).toBeVisible();
      await expect(menu).toBeInViewport({ ratio: 1 });
      await expect(menu.getByTestId(askDrawerTestIds.delete)).toBeInViewport({ ratio: 1 });
    });

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
