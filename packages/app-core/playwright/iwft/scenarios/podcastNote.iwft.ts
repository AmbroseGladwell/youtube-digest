import { expect, test } from "../../support/fixtures.testHelper.js";
import { makeOverview, makePodcastOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { silentWavDataUri } from "../../../src/features/player/util/silentWavDataUri.js";

const SPOTIFY = "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk";
const APPLE = "https://podcasts.apple.com/gb/podcast/the-diary-of-a-ceo/id1291423644?i=1000735123456";

const episodeOverview = (sharedFrom = SPOTIFY) => {
  const overview = makePodcastOverview();
  return {
    ...overview,
    source: { ...overview.source, sharedFrom, audioUrl: silentWavDataUri(), imageUrl: null },
    keyPoints: [{ text: "Most decline starts a decade before anyone notices it.", range: { startMs: 860_000, endMs: 900_000 } }],
  };
};

test("an episode's note leads with the show and its Podcast chip, and goes back to Spotify where the reader came from", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(episodeOverview());
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyEpisodeHead({ show: "The Diary Of A CEO", wayOut: "Open in Spotify", href: SPOTIFY });
  await reader.verifyWayOutItem("Open in Spotify", SPOTIFY);
  await reader.verifyCopyLinkItemReads("Copy episode link");
});

test("an episode shared from Apple Podcasts goes back there", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(episodeOverview(APPLE));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyWayOutItem("Open in Apple Podcasts", APPLE);
});

test("the episode plays in its note, and only a time in the note says a jump may land a little early", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(episodeOverview());
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  const episode = await reader.episode.verifyIsShown();
  await episode.verifyLength("1:55:48");

  await episode.clickPlay();
  await episode.verifyJumpLineShown(false);

  await reader.clickPlayChip("Play the episode from 14:20");
  await episode.verifyJumpLineShown(true);
});

test("a library row names an episode by its chip and length, and the library filters to podcasts", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  backendSimulator.overviews.seed(episodeOverview());
  backendSimulator.overviews.seed(makeOverview({ source: { ...makeOverview().source, title: "A video about pricing" } }));
  const library = await launcher.launchExpectingLibrary();
  await library.expectCardCountToBe(2);
  const row = library.cardWithTitle("Why your parents’ decline is a preview");
  await row.verifyKindChipReads("Podcast");
  await row.verifyMetaEndsWith("1 hr 56 min episode");

  await page.getByTestId("FilterPanel.moreFiltersButton").click();
  await page.getByTestId("FilterPanel.source.podcast").click();

  await library.expectCardCountToBe(1);
  await library.verifyCardOrder(["Why your parents’ decline is a preview"]);
  await expect(page.getByTestId("FilterPanel.moreFiltersSummary")).toHaveText("Podcasts · Any verdict");
});
