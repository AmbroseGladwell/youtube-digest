import { overviewPartHash, type ChatCitation, type Overview } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const PHONE = { width: 390, height: 800 };

const SKIP_LOADING = "Skip the loading phase and take the same dose from day one";
const SHAKE = "Add it to your morning shake so it becomes a habit";
const WATCH_REASON = "The note covers the dosing and the evidence.";
const HAIR_REASON = "One small study found it, and it was never repeated.";

const creatine = (): Overview => {
  const overview = makeOverview({
    keyPoints: [
      { text: "The standard dose is a few grams a day.", range: { startMs: 128_000, endMs: 176_000 } },
      { text: "Taken with strength training, creatine adds a little lean mass.", range: { startMs: 208_000, endMs: 263_000 } },
    ],
    verdict: {
      novelty: "common_knowledge",
      standsOut: null,
      dubious: true,
      dubiousClaims: [{ claim: "Creatine causes hair loss", basis: "contradictsSettled", reason: HAIR_REASON, startMs: 61_000 }],
      reasoning: "Covers the basics well.",
      similarTo: [],
    },
    sourceSteps: {
      items: [
        { text: "Take three grams a day", range: null, dubiousReason: null },
        { text: SKIP_LOADING, range: null, dubiousReason: null },
      ],
    },
    howToApply: { items: [SHAKE, "Keep a tub at work"] },
    watchAnyway: { answer: "no", reason: WATCH_REASON, range: null },
    chapters: [
      { title: "Dosing", summary: "How much to take.", startMs: 0, endMs: 60_000 },
      { title: "Hair loss", summary: "The study behind the scare.", startMs: 60_000, endMs: 120_000 },
    ],
  } as Partial<Overview>);
  overview.source.title = "Creatine, debunked";
  return overview;
};

const cite = (part: Extract<ChatCitation, { part: string }>["part"], index: number, text: string): ChatCitation => ({
  part,
  index,
  textHash: overviewPartHash(text),
});

const followed = (events: Array<{ name: string; props: Record<string, unknown> }>) =>
  events.filter(({ name }) => name === "reader.chat.citationFollowed").map(({ props }) => props);

test.describe("Chat citing the overview", () => {
  test("an answer's overview pills come first in the note's order; following one tints and focuses it, and Escape returns", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.answerWith({
      text: "Start with Step 1 and skip loading. Add it to your morning shake.",
      inSource: true,
      citations: [{ startMs: 208_000, endMs: 263_000 }, cite("howToApply", 0, SHAKE), cite("step", 1, SKIP_LOADING)],
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.askInNote("How do I start?");

    await reader.chat.verifyCitationRowReads(0, ["Step 2", "How to apply", "3:28–4:23"]);
    await reader.chat.verifyOverviewCitationsNamed(0, [
      "Go to Step 2 in the overview: Skip the loading phase and take…",
      "Go to How to apply in the overview: Add it to your morning shake…",
    ]);

    await reader.chat.followOverviewCitation(0, 0);

    await reader.chat.verifyOverviewPartCited(SKIP_LOADING);
    await reader.chat.verifyCitedSaid("Showing Step 2 in the overview. Escape returns to the answer.");
    await expect
      .poll(() => followed(backendSimulator.analytics.events()))
      .toEqual([expect.objectContaining({ to: "overview", part: "step", index: 1 })]);

    await reader.chat.pressEscape();

    await reader.chat.verifyOverviewCitationIsFocused(0, 0);
    await reader.chat.verifyIsOpen(true);
  });

  test("an answer from the overview alone has no Not from the video label, and Watch it anyway is tinted whole", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.answerWith({
      text: "Watch it anyway says no: the note covers the dosing and the evidence.",
      inSource: false,
      citations: [cite("watchAnyway", 0, WATCH_REASON)],
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.askInNote("Should I watch it?");

    await reader.chat.verifyNoNotInSource(0);

    await reader.chat.followOverviewCitation(0, 0);

    await reader.chat.verifyOverviewPartCited("Watch it anyway?");
  });

  test("a chapter opens the Chapters tab, and why it's dubious opens the reasons, each tinted", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.answerWith({
      text: "It's marked dubious because one small study found it. The chapter on hair loss covers it.",
      inSource: true,
      citations: [cite("chapter", 1, "Hair loss"), cite("dubiousClaim", 0, "Creatine causes hair loss")],
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.askInNote("Does it cause hair loss?");
    await reader.chat.verifyCitationRowReads(0, ["Why it's dubious", "Chapter: Hair loss"]);

    await reader.chat.followOverviewCitation(0, 1);

    await reader.verifyActiveTabIs("Chapters");
    await reader.chat.verifyOverviewPartCited("Hair loss");

    await reader.chat.followOverviewCitation(0, 0);

    await reader.verifyActiveTabIs("Overview");
    await reader.chat.verifyOverviewPartCited(HAIR_REASON);
  });

  test("a rewritten item leads to its section, and a section no longer in the overview is not a link", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.answerWith({
      text: "Skip loading, and it's sold by a supplement brand.",
      inSource: true,
      citations: [cite("step", 1, "Skip loading entirely"), cite("selling", 0, "A supplement brand.")],
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.askInNote("Should I load?");

    await reader.chat.verifyOverviewCitationsNamed(0, ["Go to Step 2 in the overview, since changed"]);
    await reader.chat.verifyGoneCitationReads(0, "What it's selling · no longer in the overview");

    await reader.chat.followOverviewCitation(0, 0);

    await reader.chat.verifyOverviewPartCited("The steps it gives");
    await expect
      .poll(() => followed(backendSimulator.analytics.events()))
      .toEqual([{ overviewId: expect.any(String), to: "overview", part: "step" }]);
  });

  test("a step past the fold opens the folded list to it", async ({ launcher, backendSimulator }) => {
    const steps = Array.from({ length: 10 }, (_, index) => ({ text: `Do thing number ${index + 1}`, range: null, dubiousReason: null }));
    backendSimulator.overviews.seedSynced({ ...creatine(), sourceSteps: { items: steps } });
    backendSimulator.chats.answerWith({ text: "Step 9 says so.", inSource: true, citations: [cite("step", 8, "Do thing number 9")] });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.askInNote("What's step 9?");

    await reader.chat.followOverviewCitation(0, 0);

    await reader.chat.verifyOverviewPartCited("Do thing number 9");
  });

  test("on a phone, following a part lowers the sheet to say what it shows, and raising it returns to the pill", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.answerWith({
      text: "Skip loading.",
      inSource: true,
      citations: [cite("step", 1, SKIP_LOADING)],
    });
    await page.setViewportSize(PHONE);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.askInNote("Should I load?");

    await reader.chat.followOverviewCitation(0, 0);

    await reader.chat.verifySheetIs("lowered");
    await reader.chat.verifyLoweredReads("Should I load?", "Showing Step 2 from the answer", "Back to the conversation");
    await reader.chat.verifyOverviewPartCited(SKIP_LOADING);

    await reader.chat.raiseFromLowered();

    await reader.chat.verifySheetIs("raised");
    await reader.chat.verifyOverviewCitationIsFocused(0, 0);
  });

  test("an answer drawing on another overview links to it by title and place, and one deleted since is named but not a link", async ({
    launcher,
    backendSimulator,
  }) => {
    const plants = makeOverview({ savedAt: "2026-11-01T09:00:00.000Z" });
    plants.source.title = "Eat more plants";
    const home = { ...creatine(), savedAt: "2026-11-10T09:00:00.000Z" };
    backendSimulator.overviews.seedSynced(plants);
    backendSimulator.overviews.seedSynced(home);
    backendSimulator.chats.answerWith({
      text: "Have it with a bean-heavy dinner, as Eat more plants suggests.",
      inSource: false,
      citations: [
        { overviewId: plants.id, title: "Eat more plants", item: { part: "keyPoint", index: 1, textHash: overviewPartHash("x") } },
        { overviewId: "6c1d3a7e-2b4f-4e8a-9c5d-1f2e3a4b5c6d" as Overview["id"], title: "Sleep first", item: null },
      ],
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.askInNote("How does this fit with my other overviews?");

    await reader.chat.verifyNoNotInSource(0);
    await reader.chat.verifyOtherOverviewCitationsNamed(0, ["Open your overview Eat more plants · Key point 2"]);
    await reader.chat.verifyDeletedOtherOverviewReads(0, "Sleep first · an overview you deleted");

    await reader.chat.followOtherOverviewCitation(0, 0);

    await reader.verifyTitle("Eat more plants");
    await expect
      .poll(() => followed(backendSimulator.analytics.events()))
      .toEqual([expect.objectContaining({ to: "otherOverview", part: "keyPoint", index: 1 })]);
  });
});
