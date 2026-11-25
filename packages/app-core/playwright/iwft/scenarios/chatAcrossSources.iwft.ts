import { overviewPartHash, type ChatCitation, type Overview } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeProject, makeProjectMember } from "../../../src/features/projects/types/ProjectFactory.testHelper.js";
import { useATouchScreen } from "../../support/reflowConditions.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const titled = (title: string, savedAt: string): Overview => {
  const overview = makeOverview({ savedAt });
  overview.source.title = title;
  return overview;
};

const LONG_TITLE = "A very long title about everything you ever wanted to know about fermenting vegetables at home";

const STEW = "Bean & halloumi stew";
const SOUP = "Chorizo & chickpea soup";
const PLANTS = "Eat more plants";
const CURRY = "One-pot prawn & lentil curry";
const CURRY_THUMBNAIL = "https://i.ytimg.example/curry.jpg";

test.describe("Chat across sources", () => {
  test("typing @ offers projects and the newest overviews, filters by title, and Enter pins one, which the question sends and shows above it", async ({
    launcher,
    backendSimulator,
  }) => {
    const soup = titled(SOUP, "2026-11-02T09:00:00.000Z");
    const plants = titled(PLANTS, "2026-11-03T09:00:00.000Z");
    const home = titled(STEW, "2026-11-10T09:00:00.000Z");
    const dinner = { ...makeProject({ name: "Dinner Recipes" }), archivedAt: null };
    for (const overview of [soup, plants, home]) {
      backendSimulator.overviews.seedSynced(overview);
    }
    backendSimulator.projects.seed(dinner);
    backendSimulator.projects.seedMember(makeProjectMember(dinner, soup.id));
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.openFromMenu();

    await reader.chat.openPickerWithButton();

    await reader.chat.verifyPickerOffers(["Dinner Recipes", PLANTS, SOUP]);
    await reader.chat.verifyPickerDetailsRead(["1 overview", "Video", "Video"]);

    await reader.chat.type("Which fits @chori");

    await reader.chat.verifyPickerOffers([SOUP]);

    await reader.chat.pressInField("Enter");

    await reader.chat.verifyPickerIsOpen(false);
    await reader.chat.verifyFieldReads("Which fits ");
    await reader.chat.verifyNextSourcesRead([SOUP]);

    await reader.chat.type("@nothing like it");

    await reader.chat.verifyPickerLineReads("Nothing called ‘nothing like it’. Try a word from the title, or a project’s name.");

    await reader.chat.pressInField("Escape");
    await reader.chat.verifyPickerIsOpen(false);
    await reader.chat.ask("Which recipe fits this best?");

    await reader.chat.verifyDrewOn("pinned", 0, [SOUP]);
    await reader.chat.verifyDrewOn("found", 0, null);
    expect(backendSimulator.chats.questions()[0]).toMatchObject({
      pins: { overviews: [soup.id], projects: [] },
      setAside: [],
      searchLibrary: true,
    });
    await reader.chat.verifyNextSourcesRead([SOUP]);

    await reader.chat.followDrewOn("pinned", 0);

    await reader.verifyTitle(SOUP);
  });

  test("what search found shows below the question and goes with the next one, until it's removed, which sets it aside", async ({
    launcher,
    backendSimulator,
  }) => {
    const plants = titled(PLANTS, "2026-11-03T09:00:00.000Z");
    const home = titled(STEW, "2026-11-10T09:00:00.000Z");
    backendSimulator.overviews.seedSynced(plants);
    backendSimulator.overviews.seedSynced(home);
    backendSimulator.chats.answerWith({ text: "Have a large handful of beans a day.", found: [{ overviewId: plants.id, title: PLANTS }] });
    backendSimulator.chats.answerWith({ text: "Add a side of greens." });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.askInNote("How do my healthy-eating overviews apply to this?");

    await reader.chat.verifyDrewOn("found", 0, [PLANTS]);
    await reader.chat.verifyDrewOn("pinned", 0, null);
    await reader.chat.verifyNextSourcesRead([PLANTS]);

    await reader.chat.removeNextSource(0);

    await reader.chat.verifyNextSourcesRead([]);

    await reader.chat.ask("And the greens?");

    await reader.chat.verifyDrewOn("found", 1, null);
    expect(backendSimulator.chats.questions()[1]).toMatchObject({ setAside: [plants.id], pins: { overviews: [], projects: [] } });
    await reader.chat.verifyNextSourcesRead([]);
  });

  test("more than two sources fold into +N, whose menu removes any of them or clears them all", async ({ launcher, backendSimulator }) => {
    const curry = titled(CURRY, "2026-11-04T09:00:00.000Z");
    Object.assign(curry.source, { thumbnailUrl: CURRY_THUMBNAIL });
    const others = [titled(SOUP, "2026-11-02T09:00:00.000Z"), titled(PLANTS, "2026-11-03T09:00:00.000Z"), curry];
    for (const overview of [...others, titled(STEW, "2026-11-10T09:00:00.000Z")]) {
      backendSimulator.overviews.seedSynced(overview);
    }
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.openFromMenu();
    await reader.chat.type("@");

    await reader.chat.verifyPickerThumbnailsRead([CURRY_THUMBNAIL, null, null]);

    await reader.chat.choosePickerOption(0);
    for (let pinned = 1; pinned < 3; pinned += 1) {
      await reader.chat.type("@");
      await reader.chat.choosePickerOption(0);
    }

    await reader.chat.verifyNextSourcesRead([CURRY, PLANTS, "+1"]);

    await reader.chat.openMoreSources();

    await reader.chat.verifyMoreSourcesRead([CURRY, PLANTS, SOUP]);
    await reader.chat.verifyMoreSourceThumbnailsRead([CURRY_THUMBNAIL, null, null]);

    await reader.chat.clearAllSources();

    await reader.chat.verifyNextSourcesRead([]);
  });

  test("a long +N menu fits the room above it and scrolls inside itself", async ({ launcher, backendSimulator, page }) => {
    await page.setViewportSize({ width: 1200, height: 560 });
    for (let at = 0; at < 13; at += 1) {
      backendSimulator.overviews.seedSynced(
        titled(`Pinned overview ${at + 1}`, `2026-11-${String(at + 1).padStart(2, "0")}T09:00:00.000Z`),
      );
    }
    backendSimulator.overviews.seedSynced(titled(STEW, "2026-11-20T09:00:00.000Z"));
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.openFromMenu();
    for (let pinned = 0; pinned < 12; pinned += 1) {
      await reader.chat.type("@");
      await reader.chat.choosePickerOption(0);
    }

    await reader.chat.openMoreSources();

    await reader.chat.verifyMoreSourcesFitAndScrollWithin();
  });

  test("Search my library off sends no found sources, and the conversation remembers it; a new one starts with it on", async ({
    launcher,
    backendSimulator,
  }) => {
    const plants = titled(PLANTS, "2026-11-03T09:00:00.000Z");
    backendSimulator.overviews.seedSynced(plants);
    backendSimulator.overviews.seedSynced(titled(STEW, "2026-11-10T09:00:00.000Z"));
    backendSimulator.chats.answerWith({ text: "Only the stew itself.", found: [{ overviewId: plants.id, title: PLANTS }] });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.openFromMenu();
    await reader.chat.verifySearchLibraryIs(true);

    await reader.chat.switchSearchLibrary();

    await reader.chat.verifySearchLibraryIs(false);

    await reader.chat.pressEscape();
    await reader.chat.ask("What goes with it?");

    await reader.chat.verifyDrewOn("found", 0, null);
    expect(backendSimulator.chats.questions()[0]).toMatchObject({ searchLibrary: false });
    await expect
      .poll(() =>
        backendSimulator.analytics
          .events()
          .filter(({ name }) => name === "reader.chat.searchLibrarySwitched")
          .map(({ props }) => props),
      )
      .toEqual([expect.objectContaining({ on: false })]);
    await reader.chat.verifySearchLibraryIs(false);

    await reader.chat.pressEscape();
    await reader.chat.newConversation();

    await reader.chat.verifySearchLibraryIs(true);
  });

  test("an answer in sections shows each heading, its sources by how they relate, and a takeaway, with every source in the Sources menu", async ({
    launcher,
    backendSimulator,
  }) => {
    const plants = titled(PLANTS, "2026-11-03T09:00:00.000Z");
    backendSimulator.overviews.seedSynced(plants);
    backendSimulator.overviews.seedSynced(titled(STEW, "2026-11-10T09:00:00.000Z"));
    const beans: ChatCitation = {
      overviewId: plants.id,
      title: PLANTS,
      item: { part: "keyPoint", index: 0, textHash: overviewPartHash("x") },
    };
    backendSimulator.chats.answerWith({
      text: "It fits the beans reflex.\n\nBeans every day\nHave a large handful.\n\nTakeaway: start with the stew.",
      inSource: false,
      citations: [beans],
      found: [{ overviewId: plants.id, title: PLANTS }],
      sections: {
        intro: "It fits the beans reflex.",
        introSources: [],
        sections: [
          {
            heading: "Beans every day",
            paragraphs: ["Have a large handful."],
            numbered: [],
            bullets: [],
            sources: [{ citation: beans, relation: "Supports" }],
          },
        ],
        takeaway: "Start with the stew.",
      },
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.askInNote("How do my healthy-eating overviews apply to this?");

    await reader.chat.verifySectionsRead(0, ["Beans every day", "Takeaway"]);
    await reader.chat.verifySectionSourcesRead(0, 0, [`Based on${PLANTS} · Key point 1`]);
    await reader.chat.verifyNoCitationRow(0);

    await reader.chat.openSourcesMenu(0);

    await reader.chat.verifySourcesMenuReads(0, 1, [`${PLANTS} · Key point 1`]);
  });

  test("an answer's bold shows as bold, and more than two found overviews fold into +N", async ({ launcher, backendSimulator }) => {
    const found = [
      titled(PLANTS, "2026-11-03T09:00:00.000Z"),
      titled(SOUP, "2026-11-04T09:00:00.000Z"),
      titled(CURRY, "2026-11-05T09:00:00.000Z"),
    ];
    for (const overview of [...found, titled(STEW, "2026-11-10T09:00:00.000Z")]) {
      backendSimulator.overviews.seedSynced(overview);
    }
    backendSimulator.chats.answerWith({
      text: "Have **a large handful** of beans a day.",
      found: found.map((overview) => ({ overviewId: overview.id, title: overview.source.title })),
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.askInNote("How do my healthy-eating overviews apply to this?");

    await reader.chat.verifyBoldRead(0, ["a large handful"]);
    await reader.chat.verifyDrewOnFolds("found", 0, [PLANTS, SOUP], [CURRY]);
  });

  test("an answer's inline code, links and code blocks render, and a block copies (OV-364)", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seedSynced(titled(STEW, "2026-11-10T09:00:00.000Z"));
    backendSimulator.chats.answerWith({
      text: "Run `npm test` first, and read [the guide](https://example.com/guide).\n```bash\nnpm test  --watch\n```",
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.askInNote("How do I run the tests?");

    await reader.chat.verifyMarkdownRead(0, { code: ["npm test"], links: ["the guide"], blocks: ["npm test  --watch"] });
    await reader.chat.copyCodeBlock(0, 0, "npm test  --watch");
  });

  test("a code block inside a section's numbered or bulleted item renders as a block, not inline, and copies (OV-372)", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seedSynced(titled(STEW, "2026-11-10T09:00:00.000Z"));
    const rule = 'rules: {\n  "no-explicit-any": "error",\n}';
    backendSimulator.chats.answerWith({
      text: "Two rules to start with.",
      sections: {
        intro: "Two rules to start with.",
        introSources: [],
        sections: [
          {
            heading: "Example rules",
            paragraphs: [],
            numbered: [{ text: "Run the linter:\n```bash\nnpm run lint\n```", sources: [] }],
            bullets: [
              { text: `Ban explicit \`any\`:\n\`\`\`js\n${rule}\n\`\`\`\nThen fix what it finds.`, sources: [] },
              { text: "Keep tests beside the rules.", sources: [] },
            ],
            sources: [],
          },
        ],
        takeaway: "",
      },
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.askInNote("What lint rules should I add?");

    await reader.chat.verifyMarkdownRead(0, { code: ["any"], links: [], blocks: ["npm run lint", rule] });
    await reader.chat.verifyCodeBlocksInListItems(0, 2);
    await reader.chat.copyCodeBlock(0, 1, rule);
  });

  test("on a narrow phone, sources with long titles fold into +N by the room they have, never wider than the panel", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const longTitles = [
      "A very long title about everything you ever wanted to know about fermenting vegetables at home",
      "Another remarkably long title on slow-cooked beans, lentils and every pulse in between",
      "A third long title covering weeknight curries from start to finish without any shortcuts",
    ];
    for (const [index, title] of longTitles.entries()) {
      backendSimulator.overviews.seedSynced(titled(title, `2026-11-0${index + 2}T09:00:00.000Z`));
    }
    backendSimulator.overviews.seedSynced(titled(STEW, "2026-11-10T09:00:00.000Z"));
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.openFromMenu();

    for (let pinned = 0; pinned < 3; pinned += 1) {
      await reader.chat.type("@");
      await reader.chat.choosePickerOption(0);
    }

    await reader.chat.verifyNextSourcesRead([longTitles[2]!, "+2"]);
    await reader.chat.verifyNextSourcesWithinPanel();
  });

  test("a source's cut-off title shows in full in a tip on hover and keyboard focus, also in the +N menu, and goes on leaving, Escape or a scroll; a title that fits shows none (OV-392)", async ({
    launcher,
    backendSimulator,
  }) => {
    const found = [
      titled(LONG_TITLE, "2026-11-03T09:00:00.000Z"),
      titled(SOUP, "2026-11-04T09:00:00.000Z"),
      titled(CURRY, "2026-11-05T09:00:00.000Z"),
    ];
    for (const overview of [...found, titled(STEW, "2026-11-10T09:00:00.000Z")]) {
      backendSimulator.overviews.seedSynced(overview);
    }
    backendSimulator.chats.answerWith({
      text: "Have a large handful of beans a day.",
      found: found.map((overview) => ({ overviewId: overview.id, title: overview.source.title })),
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.askInNote("How do my healthy-eating overviews apply to this?");

    await reader.chat.hoverDrewOnChip("found", 0, 0);

    await reader.chat.verifyChipTipReads(LONG_TITLE);

    await reader.chat.moveMouseAway();

    await reader.chat.verifyChipTipReads(null);

    await reader.chat.focusDrewOnChip("found", 0, 0);

    await reader.chat.verifyChipTipReads(LONG_TITLE);

    await reader.chat.pressEscape();

    await reader.chat.verifyChipTipReads(null);

    await reader.chat.hoverDrewOnChip("found", 0, 0);
    await reader.chat.scrollPanel();

    await reader.chat.verifyChipTipReads(null);

    await reader.chat.verifyDrewOnFolds("found", 0, [LONG_TITLE, SOUP], [CURRY]);
    await reader.chat.hoverDrewOnChip("found", 0, 1, true);

    await reader.chat.verifyChipTipReads(null);

    await reader.chat.hoverDrewOnChip("found", 0, 0, true);

    await reader.chat.verifyChipTipReads(LONG_TITLE);
    await reader.chat.verifyChipTipWithinScreen();
  });

  test("on a narrow touch screen a source's cut-off title shows in a tip on a long press, inside the screen, gone once the finger lifts, without following it (OV-392)", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await useATouchScreen(page);
    const found = titled(LONG_TITLE, "2026-11-03T09:00:00.000Z");
    backendSimulator.overviews.seedSynced(found);
    backendSimulator.overviews.seedSynced(titled(STEW, "2026-11-10T09:00:00.000Z"));
    backendSimulator.chats.answerWith({
      text: "Have a large handful of beans a day.",
      found: [{ overviewId: found.id, title: LONG_TITLE }],
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.askInNote("How do my healthy-eating overviews apply to this?");

    await reader.chat.holdDrewOnChip("found", 0, 0);

    await reader.chat.verifyChipTipReads(LONG_TITLE);
    await reader.chat.verifyChipTipWithinScreen();

    await reader.chat.liftDrewOnChip("found", 0, 0);

    await reader.chat.verifyChipTipReads(null);
    await reader.chat.verifyDrewOn("found", 0, [LONG_TITLE]);
  });
});
