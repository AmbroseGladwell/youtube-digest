import { VideoId, sourceKey } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview, makePodcastOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
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

  await reader.verifyEpisodeHead({ show: "The Diary Of A CEO", wayOut: "Listen on Spotify", href: SPOTIFY });
  await reader.verifyWayOutItem("Listen on Spotify", SPOTIFY);
  await reader.verifyCopyLinkItemReads("Copy episode link");
});

test("an episode shared from Apple Podcasts goes back there", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(episodeOverview(APPLE));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyWayOutItem("Listen on Apple Podcasts", APPLE);
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

test("an episode's transcript says it is playing here and machine-transcribed, never YouTube's words", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = episodeOverview();
  backendSimulator.overviews.seed(overview);
  backendSimulator.transcripts.seed(
    makeStoredTranscript({
      videoId: VideoId.parse(sourceKey(overview.source)!),
      segments: [{ startMs: 0, endMs: 600_000, text: "Most decline starts a decade before anyone notices it." }],
      generated: true,
    }),
  );
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  const episode = await reader.episode.verifyIsShown();
  await reader.clickTab("Transcript");
  await reader.verifyShowsMachineTranscribedNote("Machine-transcribed");

  await episode.clickPlay();
  await reader.verifyFollowingNoteReads("Following the episode");
  await reader.verifyCurrentBlockSaysPlaying("Playing");
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

  await library.filterMenu.clickKind("podcast");

  await library.expectCardCountToBe(1);
  await library.verifyCardOrder(["Why your parents’ decline is a preview"]);
  await library.verifyChipsRead(["Podcast"]);
});
