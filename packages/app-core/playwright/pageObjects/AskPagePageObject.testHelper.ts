import { expect } from "@playwright/experimental-ct-react";
import { chatMeterLineTestIds } from "../../src/features/chats/components/ChatMeterLine/ChatMeterLineTestIds.js";
import { chatWaitBlockTestIds } from "../../src/features/chats/components/ChatWaitBlock/ChatWaitBlockTestIds.js";
import { chatCodeBlockTestIds } from "../../src/features/chats/components/ChatCodeBlock/ChatCodeBlockTestIds.js";
import { chatMarkedTextTestIds } from "../../src/features/chats/components/ChatMarkedText/ChatMarkedTextTestIds.js";
import { askPageTestIds } from "../../src/features/chats/AskPage/AskPageTestIds.js";
import { askAnswerTestIds } from "../../src/features/chats/components/AskAnswer/AskAnswerTestIds.js";
import { askDrawerTestIds } from "../../src/features/chats/components/AskDrawer/AskDrawerTestIds.js";
import { conversationSearchTestIds } from "../../src/features/chats/components/ConversationSearch/ConversationSearchTestIds.js";
import { askPickingWaitTestIds } from "../../src/features/chats/components/AskPickingWait/AskPickingWaitTestIds.js";
import { chatAnswerTestIds } from "../../src/features/chats/components/ChatAnswer/ChatAnswerTestIds.js";
import { chatComposerTestIds } from "../../src/features/chats/components/ChatComposer/ChatComposerTestIds.js";
import { chatDrewOnTestIds } from "../../src/features/chats/components/ChatDrewOn/ChatDrewOnTestIds.js";
import { chatChipRowTestIds } from "../../src/features/chats/components/ChatChipRow/ChatChipRowTestIds.js";
import { chatFieldTestIds } from "../../src/features/chats/components/ChatField/ChatFieldTestIds.js";
import { cutTextTestIds } from "../../src/components/shared/CutText/CutTextTestIds.js";
import { askQuestionCardTestIds } from "../../src/features/chats/components/AskQuestionCard/AskQuestionCardTestIds.js";
import { askQuestionCardsTestIds } from "../../src/features/chats/components/AskQuestionCards/AskQuestionCardsTestIds.js";
import { askQuestionReferencesTestIds } from "../../src/features/chats/components/AskQuestionReferences/AskQuestionReferencesTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { ReaderPageObject } from "./ReaderPageObject.testHelper.js";

export class AskPagePageObject extends PageObject {
  private root = () => this.page.getByTestId(askPageTestIds.root);
  private field = () => this.root().getByTestId(chatFieldTestIds.input);
  private answers = () => this.root().getByTestId(askAnswerTestIds.root);
  private drawer = () => this.page.getByTestId(askDrawerTestIds.root);
  private cards = () => this.root().getByTestId(askQuestionCardTestIds.card);
  private card = (index: number) => this.cards().nth(index);

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

  verifyWaitReads = (heading: string, body: string, action: string | null) =>
    this.step(`verifyWaitReads ${heading}`, async () => {
      const wait = this.root().getByTestId(chatWaitBlockTestIds.root);
      await expect(wait.getByTestId(chatWaitBlockTestIds.heading)).toHaveText(heading);
      await expect(wait.getByTestId(chatWaitBlockTestIds.body)).toHaveText(body);
      await (action === null
        ? expect(wait.getByTestId(chatWaitBlockTestIds.action)).toHaveCount(0)
        : expect(wait.getByTestId(chatWaitBlockTestIds.action)).toHaveText(action));
      await expect(this.field()).toHaveCount(0);
    });

  verifyMeterReads = (text: string | null) =>
    this.step(`verifyMeterReads ${text}`, () =>
      text === null
        ? expect(this.root().getByTestId(chatMeterLineTestIds.root)).toHaveCount(0)
        : expect(this.root().getByTestId(chatMeterLineTestIds.text)).toHaveText(text),
    );

  type = (text: string) => this.step(`type ${text}`, () => this.field().fill(text));

  ask = (question: string) =>
    this.step(`ask ${question}`, async () => {
      await this.field().fill(question);
      await this.field().press("Enter");
    });

  choosePickerOption = (index: number) =>
    this.step(`choosePickerOption ${index}`, () => this.click(this.root().getByTestId(chatComposerTestIds.option).nth(index)));

  verifyMutedPickerOption = (title: string) =>
    this.step(`verifyMutedPickerOption ${title}`, async () => {
      const option = this.root().getByTestId(chatComposerTestIds.savedOption);
      await expect(option).toHaveAttribute("aria-disabled", "true");
      await expect(option).toContainText(title);
      await expect(option).toContainText("No overview yet, so it can’t be asked about yet");
      await expect(this.root().getByTestId(chatComposerTestIds.savedGetPlus)).toHaveText("Get Plus");
    });

  tryMutedPickerOption = () =>
    this.step("tryMutedPickerOption", async () => {
      await this.root().getByTestId(chatComposerTestIds.savedOption).locator("b").click();
      await expect(this.root().getByTestId(chatComposerTestIds.picker)).toBeVisible();
      await expect(this.root().getByTestId(chatComposerTestIds.sources)).toHaveCount(0);
    });

  pickWithEnter = () => this.step("pickWithEnter", () => this.field().press("Enter"));

  getPlusFromMutedPickerOption = () =>
    this.step("getPlusFromMutedPickerOption", () => this.click(this.root().getByTestId(chatComposerTestIds.savedGetPlus)));

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

  verifyChipRowsWithinAnswer = (answer: number) =>
    this.step(`verifyChipRowsWithinAnswer ${answer}`, async () => {
      const spill = await this.answers()
        .nth(answer)
        .evaluate((root, rowId) => {
          const edge = root.getBoundingClientRect().right;
          return Math.max(
            0,
            ...[...root.querySelectorAll(`[data-testid="${rowId}"]`)].map((row) => row.getBoundingClientRect().right - edge),
          );
        }, chatChipRowTestIds.root);
      expect(spill).toBeLessThanOrEqual(0.5);
    });

  verifyItemSourcesFold = (answer: number, section: number, item: number, shown: number, more: number) =>
    this.step(`verifyItemSourcesFold ${answer} ${section} ${item}`, async () => {
      const row = this.answers()
        .nth(answer)
        .getByTestId(chatAnswerTestIds.section)
        .nth(section)
        .locator("li")
        .nth(item)
        .getByTestId(chatAnswerTestIds.itemSources);
      await expect(row.getByRole("link")).toHaveCount(shown);
      await expect(row.getByTestId(chatChipRowTestIds.more)).toHaveText(`+${more}`);
    });

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

  openDrawerWhereFolded = () =>
    this.step("openDrawerWhereFolded", async () => {
      if ((await this.drawer().count()) === 0) {
        await this.openDrawer();
      }
    });

  private drawerSearch = () => this.drawer().getByTestId(conversationSearchTestIds.input);
  private drawerSearchBox = () => this.drawer().getByTestId(conversationSearchTestIds.root);

  searchDrawer = (text: string) => this.step(`searchDrawer ${text}`, () => this.drawerSearch().fill(text));

  drawerSearchTop = () =>
    this.step("drawerSearchTop", async () => {
      await this.drawer().evaluate((drawer) => Promise.all(drawer.getAnimations({ subtree: true }).map((animation) => animation.finished)));
      return Math.round((await this.drawerSearchBox().boundingBox())!.y);
    });

  verifyDrawerSearchTopIs = (top: number) =>
    this.step(`verifyDrawerSearchTopIs ${top}`, () =>
      expect.poll(async () => Math.round((await this.drawerSearchBox().boundingBox())!.y)).toBe(top),
    );

  verifyDrawerShows = (count: number) =>
    this.step(`verifyDrawerShows ${count}`, () => expect(this.drawer().getByTestId(askDrawerTestIds.item)).toHaveCount(count));

  verifyDrawerControlsCanBeReached = () => this.verifyControlsCanBeReached(this.drawer());

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

  verifyQuestionCardsRead = (questions: string[]) =>
    this.step(`verifyQuestionCardsRead ${questions.join(" | ")}`, async () => {
      await expect(this.root().getByRole("list", { name: "Questions to start with" })).toBeVisible();
      await expect(this.root().getByTestId(askQuestionCardTestIds.question)).toHaveText(questions);
    });

  verifyNoQuestionCards = () =>
    this.step("verifyNoQuestionCards", async () => {
      await expect(this.cards()).toHaveCount(0);
      await expect(this.root().getByTestId(askQuestionCardsTestIds.different)).toHaveCount(0);
    });

  verifyReferencesCount = (count: number) =>
    this.step(`verifyReferencesCount ${count}`, () =>
      expect(this.root().getByTestId(askQuestionReferencesTestIds.button)).toHaveCount(count),
    );

  verifyQuestionCardsWait = (waiting: boolean) =>
    this.step(`verifyQuestionCardsWait ${waiting}`, async () => {
      for (const question of await this.root().getByTestId(askQuestionCardTestIds.question).all()) {
        await (waiting ? expect(question).toBeDisabled() : expect(question).toBeEnabled());
      }
    });

  chooseQuestionCard = (index: number) =>
    this.step(`chooseQuestionCard ${index}`, () => this.click(this.card(index).getByTestId(askQuestionCardTestIds.question)));

  verifyBubbleTintsWithTailOnHover = (index: number) =>
    this.step(`verifyBubbleTintsWithTailOnHover ${index}`, async () => {
      const card = this.card(index);
      const colours = () =>
        card.evaluate((element) => ({
          bubble: getComputedStyle(element).backgroundColor,
          tail: getComputedStyle(element, "::after").backgroundColor,
        }));
      const resting = await colours();
      expect(resting.tail).toBe(resting.bubble);
      await card.getByTestId(askQuestionCardTestIds.question).hover();
      await expect
        .poll(async () => {
          const { bubble, tail } = await colours();
          return { tinted: bubble !== resting.bubble, tailMatches: tail === bubble };
        })
        .toEqual({ tinted: true, tailMatches: true });
    });

  verifyQuestionCardHasNoIcon = (index: number) =>
    this.step(`verifyQuestionCardHasNoIcon ${index}`, () =>
      expect(this.card(index).getByTestId(askQuestionCardTestIds.question).locator("svg")).toHaveCount(0),
    );

  verifyReferencesBesideFirstLine = (index: number, size: number) =>
    this.step(`verifyReferencesBesideFirstLine ${index} ${size}`, async () => {
      const question = this.card(index).getByTestId(askQuestionCardTestIds.question);
      const button = this.card(index).getByTestId(askQuestionReferencesTestIds.button);
      const asked = (await question.boundingBox())!;
      const references = (await button.boundingBox())!;
      const firstLineMiddle = await question.evaluate((element) => {
        const style = getComputedStyle(element);
        return element.getBoundingClientRect().top + parseFloat(style.paddingTop) + parseFloat(style.lineHeight) / 2;
      });
      expect(references.height).toBeGreaterThanOrEqual(size);
      expect(references.width).toBeGreaterThanOrEqual(size);
      expect(references.x).toBeGreaterThanOrEqual(asked.x + asked.width);
      expect(Math.abs(references.y + references.height / 2 - firstLineMiddle)).toBeLessThan(1.5);
      await expect(button).not.toContainText(/\d/);
    });

  verifyReferencesTipReads = (index: number, text: string) =>
    this.step(`verifyReferencesTipReads ${index} ${text}`, async () => {
      const button = this.card(index).getByTestId(askQuestionReferencesTestIds.button);
      await button.hover();
      const tip = button.getByTestId(askQuestionReferencesTestIds.tip);
      await expect(tip).toBeVisible();
      await expect(tip).toHaveText(text);
    });

  holdReferences = (index: number, text: string) =>
    this.step(`holdReferences ${index}`, async () => {
      const button = this.card(index).getByTestId(askQuestionReferencesTestIds.button);
      await button.dispatchEvent("touchstart");
      await expect(button).toHaveAttribute("data-held", "");
      await expect(button.getByTestId(askQuestionReferencesTestIds.tip)).toHaveText(text);
      await expect(button.getByTestId(askQuestionReferencesTestIds.tip)).toBeVisible();
      await button.dispatchEvent("touchend");
    });

  verifyDifferentQuestions = (count: string | null) =>
    this.step(`verifyDifferentQuestions ${count}`, async () => {
      const different = this.root().getByTestId(askQuestionCardsTestIds.different);
      if (count === null) {
        await expect(different).toHaveCount(0);
        return;
      }
      await expect(different).toHaveAccessibleName(`Different questions, ${count}`);
      await expect(this.root().getByTestId(askQuestionCardsTestIds.count)).toHaveText(count);
    });

  pressDifferentQuestions = () =>
    this.step("pressDifferentQuestions", async () => {
      const different = this.root().getByTestId(askQuestionCardsTestIds.different);
      await different.focus();
      await this.page.keyboard.press("Enter");
      await expect(different).toBeFocused();
    });

  verifyQuestionsSaid = (text: string) =>
    this.step(`verifyQuestionsSaid ${text}`, () => expect(this.root().getByTestId(askQuestionCardsTestIds.said)).toHaveText(text));

  verifyReferencesNamed = (index: number, name: string) =>
    this.step(`verifyReferencesNamed ${index}`, async () => {
      const button = this.card(index).getByTestId(askQuestionReferencesTestIds.button);
      await expect(button).toHaveAccessibleName(name);
      await expect(button).toHaveAttribute("aria-haspopup", "menu");
    });

  openReferences = (index: number) =>
    this.step(`openReferences ${index}`, () => this.click(this.card(index).getByTestId(askQuestionReferencesTestIds.button)));

  private aboutMenu = (index: number) => this.card(index).getByRole("menu", { name: "About this question" });

  verifyReferencesMenuReads = (index: number, rows: Array<{ title: string; kind: string }>) =>
    this.step(`verifyReferencesMenuReads ${index}`, async () => {
      const menu = this.aboutMenu(index);
      await expect(menu).toBeVisible();
      const drawsOn = menu.getByRole("group", { name: "This question draws on" }).getByRole("menuitem");
      for (const [row, { title }] of rows.entries()) {
        await expect(drawsOn.nth(row)).toHaveAccessibleName(title);
      }
      await expect(drawsOn).toHaveText(rows.map((row) => `${row.title}${row.kind}`));
      await expect(drawsOn.first()).toBeFocused();
      await expect(menu.getByRole("separator")).toHaveCount(1);
      const feedback = menu.getByRole("group", { name: "Feedback on this question" });
      await expect(feedback.getByRole("menuitemcheckbox", { name: "Good question" })).toBeVisible();
      await expect(feedback.getByRole("menuitem")).toHaveText(["Not useful", "Hide"]);
    });

  verifyArrowKeysReachEveryItem = (index: number, names: string[]) =>
    this.step(`verifyArrowKeysReachEveryItem ${index}`, async () => {
      const menu = this.aboutMenu(index);
      const focusedName = () =>
        menu.evaluate((element) => (element.contains(document.activeElement) ? document.activeElement?.textContent : null));
      for (const name of [...names.slice(1), names[0]!]) {
        await this.page.keyboard.press("ArrowDown");
        await expect.poll(focusedName).toContain(name);
      }
      await this.page.keyboard.press("ArrowUp");
      await expect.poll(focusedName).toContain(names.at(-1)!);
    });

  private openAboutMenu = async (index: number) => {
    if ((await this.card(index).getByTestId(askQuestionReferencesTestIds.menu).count()) === 0) {
      await this.click(this.card(index).getByTestId(askQuestionReferencesTestIds.button));
    }
  };

  pressGoodQuestion = (index: number) =>
    this.step(`pressGoodQuestion ${index}`, async () => {
      await this.openAboutMenu(index);
      await this.click(this.card(index).getByTestId(askQuestionReferencesTestIds.good));
    });

  verifyGoodQuestionChecked = (index: number, checked: boolean) =>
    this.step(`verifyGoodQuestionChecked ${index} ${checked}`, async () => {
      const good = this.aboutMenu(index).getByRole("menuitemcheckbox", { name: "Good question" });
      await expect(good).toBeVisible();
      await expect(good).toHaveAttribute("aria-checked", String(checked));
    });

  pressNotUseful = (index: number) =>
    this.step(`pressNotUseful ${index}`, async () => {
      await this.openAboutMenu(index);
      await this.click(this.card(index).getByTestId(askQuestionReferencesTestIds.notUseful));
    });

  pressHide = (index: number) =>
    this.step(`pressHide ${index}`, async () => {
      await this.openAboutMenu(index);
      await this.click(this.card(index).getByTestId(askQuestionReferencesTestIds.hide));
    });

  verifyQuestionCardFocused = (index: number) =>
    this.step(`verifyQuestionCardFocused ${index}`, () =>
      expect(this.card(index).getByTestId(askQuestionCardTestIds.question)).toBeFocused(),
    );

  closeReferencesWithEscape = (index: number) =>
    this.step(`closeReferencesWithEscape ${index}`, async () => {
      await this.page.keyboard.press("Escape");
      await expect(this.card(index).getByTestId(askQuestionReferencesTestIds.menu)).toHaveCount(0);
      await expect(this.card(index).getByTestId(askQuestionReferencesTestIds.button)).toBeFocused();
    });

  chooseReference = (index: number, row: number) =>
    this.step(`chooseReference ${index} ${row}`, () =>
      this.click(this.card(index).getByTestId(askQuestionReferencesTestIds.item).nth(row)),
    );
}
