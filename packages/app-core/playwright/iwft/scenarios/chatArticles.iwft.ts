import { articlePlaceUrl, overviewPartHash, type ChatCitation, type Overview } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeArticleOverview, makeRecipeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const cite = (part: Extract<ChatCitation, { part: string }>["part"], index: number, text: string): ChatCitation => ({
  part,
  index,
  textHash: overviewPartHash(text),
});

const pageUrl = (overview: Overview): string => {
  if (overview.source.kind !== "web") {
    throw new Error("not a web page");
  }
  return overview.source.url;
};

const answeredAbout = (events: Array<{ name: string; props: Record<string, unknown> }>) =>
  events.filter(({ name }) => name === "reader.chat.answered").map(({ props }) => props.about);

test.describe("Chat about an article or a recipe page", () => {
  test("an article is answered from its overview: a key point and a chapter are cited, each can be shown on the page, and a chapter opens Chapters", async ({
    launcher,
    backendSimulator,
  }) => {
    const article: Overview = makeArticleOverview();
    const { chapters } = article.article!;
    backendSimulator.overviews.seedSynced(article);
    backendSimulator.chats.answerWith({
      text: "Half falls on council tax. The chapter on who pays sets out the split.",
      inSource: false,
      citations: [cite("chapter", 1, chapters[1]!.title), cite("keyPoint", 1, article.keyPoints[1]!.text)],
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.verifyNoteFieldAsks("Ask about this article");

    await reader.chat.askInNote("Who pays for it?");

    await reader.chat.verifyCitationRowReads(0, ["Key point 2", "Show on the page", `Chapter: ${chapters[1]!.title}`, "Show on the page"]);
    await reader.chat.verifyShowOnPageLinks(0, [
      articlePlaceUrl(pageUrl(article), chapters[article.article!.keyPointChapters[1]!]!.place),
      articlePlaceUrl(pageUrl(article), chapters[1]!.place),
    ]);
    await reader.chat.verifyNoNotInSource(0);
    await reader.chat.verifyAnnounced(
      "Answer: Half falls on council tax. The chapter on who pays sets out the split. 2 parts of the overview cited.",
    );
    await expect.poll(() => answeredAbout(backendSimulator.analytics.events())).toEqual(["article"]);

    await reader.chat.followOverviewCitation(0, 1);

    await reader.verifyActiveTabIs("Chapters");
    await reader.chat.verifyOverviewPartCited(chapters[1]!.title);
  });

  test("a question the article's overview doesn't answer says so and offers the article itself", async ({ launcher, backendSimulator }) => {
    const article = makeArticleOverview();
    backendSimulator.overviews.seedSynced(article);
    backendSimulator.chats.answerWith({ text: "The overview of this article doesn't cover it.", inSource: false, citations: [] });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.askInNote("What did the engineer's letter say?");

    await reader.chat.verifyNotInSource(0, "Not from the overview of this article");
    await reader.chat.verifyReadOnPageLinksTo(0, pageUrl(article));
    await reader.chat.verifyAnnounced("Not from the overview of this article: The overview of this article doesn't cover it.");
  });

  test("an answer that names Settings › Personalisation links straight to it", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seedSynced(makeArticleOverview());
    backendSimulator.chats.answerWith({
      text: "Nothing is known about you yet. You can tell The Overview about yourself in Settings › Personalisation.",
      inSource: false,
      citations: [],
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.askInNote("What do you know about me?");
    const settings = await reader.chat.followSettingsLink(0);

    await settings.verifySectionIsShown("personalisation");
  });

  test("a recipe page's answer cites its method and leads to the step; a decline says the recipe doesn't cover it", async ({
    launcher,
    backendSimulator,
  }) => {
    const recipePage = makeRecipeOverview();
    const step = recipePage.recipe!.steps[0]!.text;
    backendSimulator.overviews.seedSynced(recipePage);
    backendSimulator.chats.answerWith({ text: "Roast them first.", inSource: false, citations: [cite("method", 0, step)] });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.verifyNoteFieldAsks("Ask about this recipe");

    await reader.chat.askInNote("What do I do first?");

    await reader.chat.verifyCitationRowReads(0, ["Method step 1"]);
    await reader.chat.verifyShowOnPageLinks(0, []);
    await reader.chat.followOverviewCitation(0, 0);
    await reader.chat.verifyOverviewPartCited(step);
    await expect.poll(() => answeredAbout(backendSimulator.analytics.events())).toEqual(["recipe"]);

    backendSimulator.chats.answerWith({ text: "The recipe doesn't cover it.", inSource: false, citations: [] });
    await reader.chat.ask("Can I use golden syrup instead?");

    await reader.chat.verifyNotInSource(1, "Not from the recipe");
    await reader.chat.verifyReadOnPageLinksTo(1, pageUrl(recipePage));
  });
});
