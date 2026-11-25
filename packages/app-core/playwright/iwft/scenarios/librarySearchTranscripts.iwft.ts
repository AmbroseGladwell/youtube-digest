import { VideoId, type Overview } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
import { makeCaptionRun } from "../../../src/features/transcripts/types/TranscriptSegmentFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const VIDEO_ID = VideoId.parse("saidVideo001");
const SAID = "Zatsiorsky wrote the book on how much volume a set needs.";

const titled = (title: string, coreClaim: string, videoId?: VideoId): Overview => {
  const overview = makeOverview({ coreClaim });
  const source = {
    ...overview.source,
    title,
    ...(videoId === undefined ? {} : { id: videoId, url: `https://www.youtube.com/watch?v=${videoId}` }),
  };
  return { ...overview, source };
};

const seed = (backendSimulator: BackendSimulator) => {
  const arms = titled("Bigger arms in eight weeks", "More sets beat more weight for arm growth.", VIDEO_ID);
  const bread = titled("Sourdough at home", "A sourdough loaf needs a slow overnight proving.");
  backendSimulator.overviews.seed(arms);
  backendSimulator.overviews.seed(bread);
  backendSimulator.transcripts.seed(
    makeStoredTranscript({
      videoId: VIDEO_ID,
      segments: [
        ...makeCaptionRun(["Sets matter more than weight,", "as long as each is hard."], { startMs: 0, cueMs: 3500 }),
        ...makeCaptionRun([SAID], { startMs: 65_000, cueMs: 4000 }),
      ],
    }),
  );
  return { arms, bread };
};

const matchOf = (overviewId: string) => ({
  overviewId,
  mentions: 1,
  moments: [{ startMs: 65_000, text: SAID, marks: [{ start: 0, end: 10 }] }],
});

test.describe("searching the library for words said in a transcript", () => {
  test("a name only the video said is listed as said in it, and opens the transcript at that moment", async ({
    launcher,
    backendSimulator,
  }) => {
    const { arms } = seed(backendSimulator);
    backendSimulator.transcriptSearch.seed("zatsiorsky", [matchOf(arms.id)]);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);

    await library.search("zatsiorsky");

    await library.verifySaidInTranscriptsShows([
      { title: "Bigger arms in eight weeks", said: `Said in the video at 1:05${SAID}`, marked: ["Zatsiorsky"] },
    ]);
    await expect
      .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "library.search.transcriptMatched"))
      .toEqual([{ name: "library.search.transcriptMatched", props: { transcriptOnly: 1, failed: false } }]);

    const reader = await library.openTheMomentSaid("Bigger arms in eight weeks");

    await reader.verifyActiveTabIs("Transcript");
    await reader.verifyTargetTranscriptBlockReads(/Zatsiorsky wrote the book/);
    await expect
      .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "library.overviewCard.opened"))
      .toEqual([{ name: "library.overviewCard.opened", props: { overviewId: arms.id, from: "said", rowLayout: "row", plan: "free" } }]);
  });

  test("an overview its own words already found, or already said, is not listed again", async ({ launcher, backendSimulator }) => {
    const { arms, bread } = seed(backendSimulator);
    backendSimulator.transcriptSearch.seed("sourdough", [matchOf(bread.id), matchOf(arms.id)]);
    backendSimulator.meaning.seed("sourdough", [arms.id]);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);

    await library.search("sourdough");

    await library.verifySaidInTranscriptsShows([
      { title: "Bigger arms in eight weeks", said: `Said in the video at 1:05${SAID}`, marked: ["Zatsiorsky"] },
    ]);
    await library.verifyNoCloseInMeaning();
    await library.expectCardCountToBe(2);
  });

  test("when the transcripts can't be searched, the library says so", async ({ launcher, backendSimulator }) => {
    seed(backendSimulator);
    backendSimulator.simulateEndpointError(EndpointKey.TRANSCRIPT_SEARCH);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);

    await library.search("zatsiorsky");

    await library.verifyTranscriptsUnavailable();
    await library.verifyNoSaidInTranscripts();
    await expect
      .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "library.search.transcriptMatched"))
      .toEqual([{ name: "library.search.transcriptMatched", props: { transcriptOnly: 0, failed: true } }]);
  });
});
