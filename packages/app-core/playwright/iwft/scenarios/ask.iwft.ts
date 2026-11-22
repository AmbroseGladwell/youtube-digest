import type { Page } from "@playwright/test";
import { overviewPartHash, type Chat, type ChatAnswerSections, type ChatCitation, type Overview, type ProjectId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeProject, makeProjectMember } from "../../../src/features/projects/types/ProjectFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const PHONE = { width: 390, height: 800 };

// Chromium's touch emulation is what turns (hover: hover) off.
const useATouchScreen = async (page: Page) => {
  const devtools = await page.context().newCDPSession(page);
  await devtools.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
};

const titled = (title: string, savedAt: string): Overview => {
  const overview = makeOverview({ savedAt });
  overview.source.title = title;
  return overview;
};

const PLANTS = "Eat more plants";
const STEW = "Bean & halloumi stew";
const CURRY = "One-pot prawn & lentil curry";

const cite = (overview: Overview): ChatCitation => ({ overviewId: overview.id, title: overview.source.title, item: null });

const sectioned = (first: Overview, second: Overview): ChatAnswerSections => ({
  intro: "Beans and greens come up again and again.",
  introSources: [],
  sections: [
    {
      heading: "Beans every day",
      paragraphs: ["A large handful a day."],
      numbered: [],
      bullets: [],
      sources: [
        { citation: cite(first), relation: "Supports" },
        { citation: cite(second), relation: "Supports" },
      ],
    },
  ],
  takeaway: "Start with the stew.",
});

const conversation = (
  id: string,
  question: string,
  at: string,
  owner: { projectId?: ProjectId; overviewId?: Overview["id"] } = {},
): Chat => ({
  id,
  ...owner,
  startedAt: at,
  messages: [
    { from: "reader", text: question, at },
    { from: "answer", text: "An answer.", at, citations: [], inSource: true },
  ],
});

test.describe("Ask", () => {
  test("Ask in the top bar opens the page over the whole library with starters made from it; a starter asks, and the answer reads in sections with what it read and a line counted by code", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    const plants = titled(PLANTS, "2026-11-03T09:00:00.000Z");
    const stew = titled(STEW, "2026-11-04T09:00:00.000Z");
    for (const overview of [plants, stew, titled(CURRY, "2026-11-05T09:00:00.000Z")]) {
      backendSimulator.overviews.seedSynced(overview);
    }
    backendSimulator.chats.answerWith({
      text: "Beans and greens come up again and again.",
      citations: [cite(plants), cite(stew)],
      picked: [
        { overviewId: plants.id, title: PLANTS },
        { overviewId: stew.id, title: STEW },
      ],
      sections: sectioned(plants, stew),
      stats: { overviews: 3, read: 2, looked: 3 },
    });
    await launcher.launchExpectingLibrary(SIGNED_IN);

    const ask = await launcher.appShell.openAsk();

    await ask.verifyHeadingReads("Ask across everything you’ve saved.");
    await ask.verifyPlaceholderReads("Ask your library or @ to add sources");
    await ask.verifyScopeChipReads(null);
    await ask.verifyStartersRead([
      "What's worth reading first in my 3 unread overviews?",
      "What are the big themes across everything I've saved?",
      "Which ideas come up again and again in my overviews?",
    ]);

    await ask.chooseStarter(0);

    await ask.verifyQuestionsRead(["What's worth reading first in my 3 unread overviews?"]);
    expect(backendSimulator.chats.questions()[0]).toMatchObject({ overviewId: "library", pins: { overviews: [], projects: [] } });
    await ask.verifyReadLineReads(0, "Read 2 overviews");
    await ask.verifySectionsRead(0, ["Beans every day", "Takeaway"]);
    await ask.verifySectionSourcesRead(0, 0, [`Based on${PLANTS}${STEW}`]);
    await ask.verifyStatsReads(0, "Looked across your 3 overviews · read 2 in full");
    await ask.verifyAnnouncement("Answer ready");
    await expect(page).toHaveURL(/\/ask\?chat=/);

    await ask.openSourcesMenu(0);

    await ask.verifySourcesMenuReads(0, 2, [PLANTS, STEW]);

    await ask.openReadLine(0);

    await ask.verifyReadChipsRead([PLANTS, STEW]);

    await ask.followReadChip(1);

    await expect(page).toHaveURL(new RegExp(`/overviews/${stew.id}$`));
  });

  test("a project's Ask opens over that project, says so, and sends the question to it", async ({ launcher, backendSimulator }) => {
    const plants = titled(PLANTS, "2026-11-03T09:00:00.000Z");
    const stew = titled(STEW, "2026-11-04T09:00:00.000Z");
    const dinner = { ...makeProject({ name: "Dinner Recipes" }), archivedAt: null };
    for (const overview of [plants, stew]) {
      backendSimulator.overviews.seedSynced(overview);
    }
    backendSimulator.projects.seed(dinner);
    backendSimulator.projects.seedMember(makeProjectMember(dinner, plants.id));
    backendSimulator.projects.seedMember(makeProjectMember(dinner, stew.id));
    backendSimulator.chats.answerWith({
      text: "Start with the stew.",
      citations: [cite(stew)],
      sections: { intro: "Start with the stew.", introSources: [], sections: [], takeaway: "" },
      stats: { overviews: 2 },
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const head = await library.projectsRail.openProject("Dinner Recipes");

    const ask = await head.openAsk();

    await ask.verifyHeadingReads("Ask about this project.");
    await ask.verifyScopeChipReads("Dinner Recipes");
    await ask.verifyPlaceholderReads("Ask about this project or @ to add sources");
    await ask.verifyStartersRead([
      "Given what this project is for, what should I do first?",
      "Where do the overviews in Dinner Recipes disagree?",
      "What do the 2 unread overviews here add?",
    ]);

    await ask.ask("What should I cook first?");

    expect(backendSimulator.chats.questions()[0]).toMatchObject({ overviewId: `project:${dinner.id}`, text: "What should I cook first?" });
    await ask.verifyStatsReads(0, "Over this project's 2 overviews");
  });

  test("an overview pinned with @ on the Ask page goes with the question and shows above it", async ({ launcher, backendSimulator }) => {
    const plants = titled(PLANTS, "2026-11-03T09:00:00.000Z");
    backendSimulator.overviews.seedSynced(plants);
    backendSimulator.chats.answerWith({ text: "Beans.", citations: [cite(plants)], stats: { overviews: 1, read: 1 } });
    await launcher.launchExpectingLibrary(SIGNED_IN);
    const ask = await launcher.appShell.openAsk();

    await ask.type("@");
    await ask.choosePickerOption(0);
    await ask.ask("What does this say about beans?");

    expect(backendSimulator.chats.questions()[0]).toMatchObject({ pins: { overviews: [plants.id], projects: [] } });
    await ask.verifyPinnedRead(0, [PLANTS]);
  });

  test("on the web the drawer starts open (OV-370), a column at the left listing library, project and overview conversations by day; it opens a library or project one beside it, and a deleted one comes back with Undo", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    const plants = titled(PLANTS, "2026-11-03T09:00:00.000Z");
    const dinner = { ...makeProject({ name: "Dinner Recipes" }), archivedAt: null };
    backendSimulator.overviews.seedSynced(plants);
    backendSimulator.projects.seed(dinner);
    const today = new Date().toISOString();
    const earlierToday = new Date(Date.now() - 60_000).toISOString();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const libraryChat = "5d1c3e8a-0f4b-4a52-9c3e-2b7a1d9e6f01";
    const projectChat = "6e2d4f9b-1a5c-4b63-8d4f-3c8b2e0f7a12";
    backendSimulator.chats.seed(conversation(`library:${libraryChat}`, "What do my overviews agree on?", today));
    backendSimulator.chats.seed(
      conversation(`project:${dinner.id}:${projectChat}`, "What should I cook first?", yesterday, { projectId: dinner.id }),
    );
    backendSimulator.chats.seed(
      conversation(`${plants.id}:7f3e5a0c-2b6d-4c74-9e5a-4d9c3f1a8b23`, "How much?", earlierToday, { overviewId: plants.id }),
    );
    await launcher.launchExpectingLibrary(SIGNED_IN);
    await expect.poll(() => backendSimulator.chats.listLibrary()).toHaveLength(1);
    const ask = await launcher.appShell.openAsk();

    await ask.verifyDrawerIsOpen(true);

    await ask.verifyDrawerIsSheet(false);
    await ask.verifyDrawerReads([
      `Today: What do my overviews agree on? · Your library, How much? · ${PLANTS}`,
      "Yesterday: What should I cook first? · Dinner Recipes",
    ]);

    await ask.openDrawerConversation(2);

    await ask.verifyDrawerIsOpen(true);
    await ask.verifyQuestionsRead(["What should I cook first?"]);
    await expect(page).toHaveURL(new RegExp(`/ask\\?project=${dinner.id}&chat=${projectChat}$`));

    await ask.deleteDrawerConversation(0);

    await ask.verifyToastReads("Conversation deletedUndo");
    await ask.verifyDrawerReads([`Today: How much? · ${PLANTS}`, "Yesterday: What should I cook first? · Dinner Recipes"]);

    await ask.undo();

    await ask.verifyDrawerReads([
      `Today: What do my overviews agree on? · Your library, How much? · ${PLANTS}`,
      "Yesterday: What should I cook first? · Dinner Recipes",
    ]);

    await ask.newChat();

    await ask.verifyHeadingReads("Ask about this project.");

    await ask.closeDrawer();

    await ask.verifyDrawerIsOpen(false);

    await ask.openDrawer();

    await ask.verifyDrawerIsOpen(true);
    await expect.poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "ask.drawer.opened")).toHaveLength(1);
  });

  test("an overview's conversation in the drawer opens on that overview with its chat open on it, and deletes with Undo (OV-363)", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    const plants = titled(PLANTS, "2026-11-03T09:00:00.000Z");
    backendSimulator.overviews.seedSynced(plants);
    const today = new Date().toISOString();
    const earlierToday = new Date(Date.now() - 60_000).toISOString();
    backendSimulator.chats.seed(
      conversation(`${plants.id}:1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d`, "How much a day?", today, { overviewId: plants.id }),
    );
    backendSimulator.chats.seed(
      conversation(`${plants.id}:2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e`, "Which beans?", earlierToday, { overviewId: plants.id }),
    );
    await launcher.launchExpectingLibrary(SIGNED_IN);
    await expect.poll(() => backendSimulator.chats.list(plants.id)).toHaveLength(2);
    const ask = await launcher.appShell.openAsk();
    await ask.verifyDrawerIsOpen(true);
    await ask.verifyDrawerReads([`Today: How much a day? · ${PLANTS}, Which beans? · ${PLANTS}`]);

    await ask.deleteDrawerConversation(0);

    await ask.verifyToastReads("Conversation deletedUndo");
    await ask.verifyDrawerReads([`Today: Which beans? · ${PLANTS}`]);

    await ask.undo();

    await ask.verifyDrawerReads([`Today: How much a day? · ${PLANTS}, Which beans? · ${PLANTS}`]);

    const reader = await ask.openDrawerOverviewConversation(1);

    await expect(page).toHaveURL(new RegExp(`/overviews/${plants.id}$`));
    await reader.chat.verifyIsOpen(true);
    await reader.chat.verifyTitleReads("Which beans?");
    await reader.chat.verifyAnswersRead(["An answer."]);
    await expect
      .poll(() =>
        backendSimulator.analytics
          .events()
          .filter(({ name }) => name === "ask.drawer.conversationOpened")
          .map(({ props }) => props),
      )
      .toEqual([{ scope: "overview" }]);

    await page.reload();

    await reader.chat.verifyIsOpen(false);
  });

  test("in the drawer a cut-off question shows in full in a tip on hover, one that fits shows none, and New chat stays at the top as the list scrolls (OV-371)", async ({
    launcher,
    backendSimulator,
  }) => {
    const long = "Which of the overviews I saved about sleep, caffeine and training agree on when to stop drinking coffee each day?";
    backendSimulator.overviews.seedSynced(titled(PLANTS, "2026-11-03T09:00:00.000Z"));
    const now = Date.now();
    backendSimulator.chats.seed(conversation("library:0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", long, new Date(now).toISOString()));
    backendSimulator.chats.seed(
      conversation("library:1b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e", "Short one?", new Date(now - 60_000).toISOString()),
    );
    for (let day = 1; day <= 20; day += 1) {
      backendSimulator.chats.seed(
        conversation(
          `library:${String(day).padStart(8, "0")}-2c3d-4e5f-8a6b-7c8d9e0f1a2b`,
          `Earlier question ${day}?`,
          new Date(now - day * 86_400_000).toISOString(),
        ),
      );
    }
    await launcher.launchExpectingLibrary(SIGNED_IN);
    await expect.poll(() => backendSimulator.chats.listLibrary()).toHaveLength(22);
    const ask = await launcher.appShell.openAsk();
    await ask.verifyDrawerIsOpen(true);

    await ask.hoverDrawerConversation(0);

    await ask.verifyDrawerTipReads(0, long);

    await ask.hoverDrawerConversation(1);

    await ask.verifyDrawerTipReads(1, null);
    await ask.verifyDrawerTopIsPinned(false);

    await ask.scrollDrawerToEnd();

    await ask.verifyDrawerTopIsPinned(true);
  });

  test("on a phone a cut-off question's tip shows on a long press, which doesn't open the conversation (OV-371)", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    await page.setViewportSize(PHONE);
    backendSimulator.overviews.seedSynced(titled(PLANTS, "2026-11-03T09:00:00.000Z"));
    const long = "Which of the overviews I saved about sleep, caffeine and training agree on when to stop drinking coffee each day?";
    backendSimulator.chats.seed(conversation("library:0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", long, new Date().toISOString()));
    await launcher.launchExpectingLibrary(SIGNED_IN);
    await expect.poll(() => backendSimulator.chats.listLibrary()).toHaveLength(1);
    const ask = await launcher.appShell.openAsk();
    await ask.openDrawer();

    await ask.holdDrawerConversation(0);

    await ask.verifyDrawerIsOpen(true);
    await expect(page).toHaveURL(/\/ask$/);
  });

  test("on a phone Ask is a page, its drawer starts closed and is a bottom sheet, and the last conversation's menu opens where it can be seen", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    await page.setViewportSize(PHONE);
    backendSimulator.overviews.seedSynced(titled(PLANTS, "2026-11-03T09:00:00.000Z"));
    backendSimulator.chats.seed(
      conversation("library:5d1c3e8a-0f4b-4a52-9c3e-2b7a1d9e6f01", "What do my overviews agree on?", new Date().toISOString()),
    );
    await launcher.launchExpectingLibrary(SIGNED_IN);
    await expect.poll(() => backendSimulator.chats.listLibrary()).toHaveLength(1);
    const ask = await launcher.appShell.openAsk();

    await ask.verifyHeadingReads("Ask across everything you’ve saved.");
    await ask.verifyPlaceholderReads("Ask or @ to add sources");
    await ask.verifyPageDoesNotScrollSideways();

    await ask.verifyDrawerIsOpen(false);

    await ask.openDrawer();

    await ask.verifyDrawerIsSheet(true);

    await ask.openDrawerItemMenu(0);

    await ask.verifyDrawerItemMenuIsInView();
  });

  test("an answer's bold shows as bold, a long source row folds into +N, a list item has its own chip, and following it opens that overview at the cited key point", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    const beansPoint = "A large handful of beans or lentils a day feeds the gut.";
    const plants = makeOverview({
      savedAt: "2026-11-03T09:00:00.000Z",
      keyPoints: [
        { text: "Most people eat too little fibre.", range: null },
        { text: beansPoint, range: null },
        { text: "Greens with every meal.", range: null },
      ],
    });
    plants.source.title = PLANTS;
    const stew = titled(STEW, "2026-11-04T09:00:00.000Z");
    const curry = titled(CURRY, "2026-11-05T09:00:00.000Z");
    for (const overview of [plants, stew, curry]) {
      backendSimulator.overviews.seedSynced(overview);
    }
    const beans: ChatCitation = {
      overviewId: plants.id,
      title: PLANTS,
      item: { part: "keyPoint", index: 1, textHash: overviewPartHash(beansPoint) },
    };
    backendSimulator.chats.answerWith({
      text: "Start with beans.",
      citations: [beans, cite(stew), cite(curry)],
      sections: {
        intro: "Start with **beans**.",
        introSources: [],
        sections: [
          {
            heading: "Read first",
            paragraphs: [],
            numbered: [{ text: "**Eat more plants**, for the beans habit", sources: [beans] }],
            bullets: [],
            sources: [
              { citation: beans, relation: "" },
              { citation: cite(stew), relation: "" },
              { citation: cite(curry), relation: "" },
            ],
          },
        ],
        takeaway: "",
      },
      stats: { overviews: 3, read: 3 },
    });
    await launcher.launchExpectingLibrary(SIGNED_IN);
    const ask = await launcher.appShell.openAsk();

    await ask.ask("What should I read for my gut?");

    await ask.verifyBoldRead(0, ["beans", "Eat more plants"]);
    await ask.verifySectionSourcesRead(0, 0, [`Based on${PLANTS} · Key point 2${STEW}+1`]);
    await ask.verifySectionSourcesFold(0, 0, 2, 1, 3);
    await ask.verifyItemSourcesRead(0, 0, 0, [`${PLANTS} · Key point 2`]);
    await ask.verifyLatestQuestionInView();

    await ask.followItemSource(0, 0, 0);

    await expect(page).toHaveURL(new RegExp(`/overviews/${plants.id}$`));
    const cited = page.locator('[data-cited-part="true"]');
    await expect(cited.first()).toContainText(beansPoint);
    await expect(cited.first()).toBeInViewport();
  });

  test("in the empty page the @ picker opens below the field, where there's room", async ({ launcher, backendSimulator }) => {
    for (const [index, title] of [PLANTS, STEW, CURRY].entries()) {
      backendSimulator.overviews.seedSynced(titled(title, `2026-11-0${index + 3}T09:00:00.000Z`));
    }
    await launcher.launchExpectingLibrary(SIGNED_IN);
    const ask = await launcher.appShell.openAsk();

    await ask.type("@");

    await ask.verifyPickerOpensBelowField();
  });

  test("on a phone Ask and New are round icons, each named by a tooltip", async ({ launcher, backendSimulator, page }) => {
    await page.setViewportSize(PHONE);
    backendSimulator.overviews.seedSynced(titled(PLANTS, "2026-11-03T09:00:00.000Z"));
    await launcher.launchExpectingLibrary(SIGNED_IN);

    await launcher.appShell.verifyIconButtonWithTip("ask", "Ask your library");
    await launcher.appShell.verifyIconButtonWithTip("new", "New overview");
    await launcher.appShell.verifyPageDoesNotScrollSideways();
  });

  test("on a phone's touch screen a tap on Ask opens the page with no tooltip left showing, and a long press names it without opening it", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await useATouchScreen(page);
    backendSimulator.overviews.seedSynced(titled(PLANTS, "2026-11-03T09:00:00.000Z"));
    await launcher.launchExpectingLibrary(SIGNED_IN);

    await launcher.appShell.holdIconButton("ask");

    await launcher.appShell.verifyAskIsCurrent(false);
    await launcher.appShell.verifyIconButtonTipShown("ask", false);

    await launcher.appShell.openAsk();

    await launcher.appShell.verifyAskIsCurrent(true);
    await launcher.appShell.verifyIconButtonTipShown("ask", false);
  });

  test("an Ask answer's inline code, links and code blocks render as in an overview's chat, and a block copies (OV-364)", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seedSynced(titled(PLANTS, "2026-11-03T09:00:00.000Z"));
    backendSimulator.chats.answerWith({
      text: "x",
      sections: {
        intro: "Run `npm test` first, and read [the guide](https://example.com/guide).\n```bash\nnpm test  --watch\n```",
        introSources: [],
        sections: [],
        takeaway: "",
      },
      stats: { overviews: 1 },
    });
    await launcher.launchExpectingLibrary(SIGNED_IN);
    const ask = await launcher.appShell.openAsk();

    await ask.ask("How do I run the tests?");

    await ask.verifyMarkdownRead(0, { code: ["npm test"], links: ["the guide"], blocks: ["npm test  --watch"] });
    await ask.copyCodeBlock(0, 0, "npm test  --watch");
  });

  test("on a phone a section's +N menu stays on screen, and a chip to a step far down a long overview scrolls to it (OV-368)", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    await page.setViewportSize(PHONE);
    const long = (what: string, count: number) =>
      Array.from(
        { length: count },
        (_, index) => `${what} ${index + 1}: a long line that says a good deal so the overview runs far down the page.`,
      );
    const steps = long("Step", 14);
    const plants = makeOverview({
      savedAt: "2026-11-03T09:00:00.000Z",
      keyPoints: long("Point", 8).map((text) => ({ text, range: null })),
      sourceSteps: { items: steps.map((text) => ({ text, range: null, dubiousReason: null })) },
    });
    plants.source.title = PLANTS;
    const stew = titled(STEW, "2026-11-04T09:00:00.000Z");
    const curry = titled(CURRY, "2026-11-05T09:00:00.000Z");
    for (const overview of [plants, stew, curry]) {
      backendSimulator.overviews.seedSynced(overview);
    }
    const step: ChatCitation = {
      overviewId: plants.id,
      title: PLANTS,
      item: { part: "step", index: 11, textHash: overviewPartHash(steps[11]!) },
    };
    backendSimulator.chats.answerWith({
      text: "Follow the steps.",
      citations: [step, cite(stew), cite(curry)],
      sections: {
        intro: "Follow the steps.",
        introSources: [],
        sections: [
          {
            heading: "The steps",
            paragraphs: [],
            numbered: [{ text: "Do step 12", sources: [step] }],
            bullets: [],
            sources: [
              { citation: step, relation: "" },
              { citation: cite(stew), relation: "" },
              { citation: cite(curry), relation: "" },
            ],
          },
        ],
        takeaway: "",
      },
      stats: { overviews: 3, read: 3 },
    });
    await launcher.launchExpectingLibrary(SIGNED_IN);
    const ask = await launcher.appShell.openAsk();
    await ask.ask("What are the steps?");

    await ask.verifySectionSourcesFold(0, 0, 2, 1, 3);
    await ask.verifySectionSourcesMenuInView(0, 0);

    await page.keyboard.press("Escape");
    await ask.followItemSource(0, 0, 0);

    await expect(page).toHaveURL(new RegExp(`/overviews/${plants.id}$`));
    const cited = page.locator('[data-cited-part="true"]');
    await expect(cited.first()).toContainText(steps[11]!);
    await expect(cited.first()).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  });
});
