import { ShareToken, shareSnapshot, type Overview, type SharePayload, type TranscriptSegment } from "@overview/domain";
import { VideoId } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import { settingsSectionTestIds } from "../../../src/features/settings/components/SettingsSection/SettingsSectionTestIds.js";
import { appShellTestIds } from "../../../src/shell/AppShell/AppShellTestIds.js";
import { readerTabsTestIds } from "../../../src/features/reader/components/ReaderTabs/ReaderTabsTestIds.js";
import { transcriptPanelTestIds } from "../../../src/features/reader/components/TranscriptPanel/TranscriptPanelTestIds.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
import { makeCaptionRun } from "../../../src/features/transcripts/types/TranscriptSegmentFactory.testHelper.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

// OV-166, designs 166a-166h: content passing under the sticky chrome dissolves over 16px
// of --ground. Only the lowest band in a stack has content under it, so it is the only one
// the fade is drawn on; the ones above sit over the next band, which is the same --ground.

const VIDEO_ID = VideoId.parse("watchedVideo1");
const VIDEO_URL = "https://www.youtube.com/watch?v=watchedVideo1";
const TOKEN = ShareToken.parse("k7Qm2x9RfTabcdef");

// Long enough on every tab that there is something to scroll under the chrome.
const SEGMENTS: TranscriptSegment[] = Array.from({ length: 30 }, (_, index) =>
  makeCaptionRun([`Paragraph ${index} opens here,`, "carries on for a while", "and then it stops."], {
    startMs: index * 60_000,
    cueMs: 3500,
  }),
).flat();
// Seven is the schema's most (`Overview`, `SharedNote`), so the length that makes the page
// scroll comes from the words rather than the count.
const KEY_POINTS = Array.from(
  { length: 7 },
  (_, index) =>
    `Key point ${index}, written long enough to take several lines of its own on the page, so that between them these seven give the note somewhere to scroll on every layout this covers.`,
);

const longNote = (): Overview => {
  const base = makeOverview({ savedAt: "2026-09-20T00:00:00.000Z" });
  return {
    ...base,
    keyPoints: KEY_POINTS.map((text) => ({ text, range: null })),
    source: { ...base.source, id: VIDEO_ID, url: VIDEO_URL, title: "A long overview, with somewhere to scroll" },
  } as Overview;
};

const seedNote = (backendSimulator: BackendSimulator) => {
  const overview = longNote();
  backendSimulator.overviews.seed(overview);
  backendSimulator.transcripts.seed(makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }));
  return overview;
};

const seedLibrary = (backendSimulator: BackendSimulator) => {
  for (let index = 0; index < 18; index += 1) {
    const base = makeOverview();
    backendSimulator.overviews.seed({
      ...base,
      savedAt: `2026-09-${String(28 - index).padStart(2, "0")}T00:00:00.000Z`,
      source: {
        ...base.source,
        id: VideoId.parse(`vid${index}`),
        url: `https://www.youtube.com/watch?v=vid${index}`,
        title: `An overview of something worth knowing, number ${index}`,
      },
    });
  }
};

const sharedPayload = (overview: Overview): SharePayload => ({
  state: "shared",
  token: TOKEN,
  sharedAt: "2026-09-30T11:00:00.000Z",
  snapshot: shareSnapshot({
    overview,
    narration: null,
  }),
});

// Design 166b: the fade is a scroll state, not a part of the bar. At the top of the page
// the bar ends where it always did.
test("the library fades under the bar once it has scrolled, and not before", async ({ launcher, backendSimulator }) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  await library.verifyFadeHangsFrom(appShellTestIds.masthead);
  await library.verifyFadeIsShown(false);

  await library.scrollToTheFoot();

  await library.verifyFadeIsShown(true);
});

// Design 166d: not under the bar, which would do nothing for 12px of ground and then land
// its last pixels on the tab strip's own track.
test("an overview fades under the tab strip, and under the transcript's tools on that tab", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  // The wide reader's own head scrolls away with the note, so it is no band at all.
  await reader.verifyStickyBandsAre([appShellTestIds.masthead, readerTabsTestIds.root]);
  await reader.verifyFadeHangsFrom(readerTabsTestIds.root);
  await reader.scrollToTheFoot();
  await reader.verifyFadeIsShown(true);

  await reader.clickTab("Transcript");

  await reader.verifyFadeHangsFrom(transcriptPanelTestIds.head);
});

// Design 166f, as 205b leaves it: the panel's head goes by with the note, so its stack is
// the bar and the tabs and the fade hangs from the tabs.
test("in the panel the fade hangs from the tabs, the head having scrolled away", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel({ apiKeys: ANTHROPIC_KEY, activeVideoUrl: VIDEO_URL });
  const reader = await capture.openStoredOverview();

  await reader.verifyStickyBandsAre([appShellTestIds.masthead, readerTabsTestIds.root]);
  await reader.verifyFadeHangsFrom(readerTabsTestIds.root);
  await reader.scrollToTheFoot();
  await reader.verifyFadeIsShown(true);

  await reader.clickTab("Transcript");

  await reader.verifyFadeHangsFrom(transcriptPanelTestIds.head);
});

// Design 166h's last line: the shared page's header gets the same fade, and gives it up to
// its tab strip the same way.
test("a shared page fades under its own chrome", async ({ launcher, backendSimulator }) => {
  const overview = longNote();
  backendSimulator.transcripts.seed(makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }));
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload(sharedPayload(overview));
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const shared = await launcher.sharedOverviewPage.verifyIsShown();

  await shared.verifyFadeHangsFrom(readerTabsTestIds.root);
  await shared.verifyFadeIsShown(false);

  await shared.scrollToTheFoot();

  await shared.verifyFadeIsShown(true);
  await shared.verifyFadeHangsFrom(readerTabsTestIds.root);
});

// Design 166h: nothing sticks on settings but the bar, and 16px is the most a section's
// heading leaves clear once it is anchored. That is the constraint that set the fade's
// height over 24px, so it is the one worth holding.
test("settings fades under the bar alone, and a section's heading still clears it", async ({ launcher, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await launcher.launchExpectingFirstRun();
  await launcher.openPage(Routes.settingsSection("appearance"));
  const settings = await launcher.settingsPage.verifyIsShown();

  await settings.verifyFadeHangsFrom(appShellTestIds.masthead);
  await settings.verifyAnchorsClearTheFade(settingsSectionTestIds.heading("appearance"));
});
