import { expect } from "@playwright/experimental-ct-react";
import { VideoId, type Overview } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import {
  makeOverview,
  makeOverviewState,
} from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/supadataFixtures.js";
import { MILESTONE_LINES } from "../../../src/features/timeSaved/util/milestoneLines.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const HOUR_MS = 60 * 60 * 1000;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR_MS).toISOString();

// Every factory note takes a minute to read, so a video of n minutes saves n - 1.
const lasting = (minutes: number | null, overrides: Partial<Overview> = {}): Overview =>
  makeOverview({
    video: { ...makeOverview().video, title: `${minutes ?? "no"} minute video`, durationMs: minutes && minutes * 60_000 },
    ...overrides,
  });

const seedRead = (backendSimulator: BackendSimulator, overview: Overview) => {
  backendSimulator.overviews.seed(overview);
  backendSimulator.overviews.seedState(makeOverviewState(overview.id, { read: true }));
};

test.describe("the running total", () => {
  test("the library adds up what its read overviews saved, and leaves the unread out", async ({
    launcher,
    backendSimulator,
  }) => {
    seedRead(backendSimulator, lasting(11));
    seedRead(backendSimulator, lasting(16));
    backendSimulator.overviews.seed(lasting(120));

    const library = await launcher.launchExpectingLibrary();

    await library.verifyTimeSavedShows("25m");
    await library.verifyTimeSavedSays("25 minutes");
  });

  test("marking a row read adds its saving to the total and says so on the row", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seed(lasting(11));
    const library = await launcher.launchExpectingLibrary();
    await library.verifyTimeSavedSays("0 minutes");

    const card = library.nthCard(0);
    await card.clickMarkRead();

    await card.verifySavedChipSays("Saved you 10 min");
    await library.verifyTimeSavedSays("10 minutes");
    await library.verifyTimeSavedShows("10m");
    await card.verifyNoSavedChip();
  });

  test("marking a row unread takes its saving back off", async ({ launcher, backendSimulator }) => {
    seedRead(backendSimulator, lasting(11));
    const library = await launcher.launchExpectingLibrary();
    await library.showAll();

    await library.nthCard(0).clickMarkRead();

    await library.verifyTimeSavedSays("0 minutes");
  });

  test("a row with no video length says nothing when marked read", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(lasting(null));
    const library = await launcher.launchExpectingLibrary();

    const card = library.nthCard(0);
    await card.clickMarkRead();

    await card.verifyIsRead(true);
    await card.verifyNoSavedChip();
  });
});

test.describe("the breakdown", () => {
  test("says how the figure is counted, the next milestone and the ones reached", async ({
    launcher,
    backendSimulator,
  }) => {
    seedRead(backendSimulator, lasting(64));
    seedRead(backendSimulator, lasting(5));

    const library = await launcher.launchExpectingLibrary();
    const sheet = await library.openTimeSaved();

    await sheet.verifyFigureSays("1 hour 7 minutes");
    await sheet.verifyHowReads(
      "From 2 overviews you’ve read: each video’s length, minus the time the overview took to read.",
    );
    await sheet.verifyNextReads("5 hours");
    await sheet.verifyNextReads("233 min to go");
    await sheet.verifyReached(["30 minutes", "1 hour"]);
    await sheet.verifyNothingLeftOut();
    await sheet.close();
  });

  test("says which read overviews it could not count, and why", async ({ launcher, backendSimulator }) => {
    seedRead(backendSimulator, lasting(11));
    seedRead(backendSimulator, lasting(null));
    seedRead(backendSimulator, lasting(40, { watchAnyway: { answer: "yes", reason: "The demo is the point.", range: null } }));
    seedRead(
      backendSimulator,
      lasting(30, {
        watchAnyway: { answer: "partial", reason: "Watch the demo.", range: { startMs: 0, endMs: 10 * 60_000 } },
      }),
    );
    backendSimulator.overviews.seed(lasting(null));

    const library = await launcher.launchExpectingLibrary();
    await library.verifyTimeSavedSays("29 minutes");
    const sheet = await library.openTimeSaved();

    await sheet.verifyNotCounted([
      "1 overview without a video length",
      "1 the verdict said to watch",
      "1 the verdict said to watch in part counts without that part.",
    ]);
  });

  test("before anything is read, says how to start", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(lasting(11));

    const library = await launcher.launchExpectingLibrary();
    const sheet = await library.openTimeSaved();

    await sheet.verifyHowReads("Nothing counted yet. Mark an overview read and what it saved you shows here.");
  });
});

test.describe("milestones", () => {
  test("crossing one brings its card in under the filters, and records it on the account", async ({
    launcher,
    backendSimulator,
  }) => {
    seedRead(backendSimulator, lasting(26));
    backendSimulator.overviews.seed(lasting(7));
    const library = await launcher.launchExpectingLibrary();
    await library.milestones.verifyShowsNothing();

    await library.cardWithTitle("7 minute video").clickMarkRead();

    await library.milestones.verifyFrontCardIs("30 minutes");
    await library.milestones.verifyFigureSays("Time saved: 31 minutes");
    await library.milestones.verifyNoCount();
    await library.milestones.verifyDismissIsLabelled("Hide until your next milestone");
    await expect(async () => {
      const settings = await backendSimulator.settingsStore.get();
      expect(settings.milestones["30m"]).toMatchObject({ dismissedAt: null });
    }).toPass();
  });

  test("dismissing hides it for good, with a moment to undo", async ({ launcher, backendSimulator }) => {
    seedRead(backendSimulator, lasting(40));
    const library = await launcher.launchExpectingLibrary({ milestones: { "30m": { crossedAt: hoursAgo(1), dismissedAt: null } } });
    await library.milestones.verifyFrontCardIs("30 minutes");

    await library.milestones.dismiss();
    await library.milestones.verifyShowsNothing();
    await library.milestones.verifyOffersUndo();
    await expect(async () => {
      const settings = await backendSimulator.settingsStore.get();
      expect(settings.milestones["30m"]?.dismissedAt).not.toBeNull();
    }).toPass();

    await library.milestones.undo();
    await library.milestones.verifyFrontCardIs("30 minutes");
    await expect(async () => {
      const settings = await backendSimulator.settingsStore.get();
      expect(settings.milestones["30m"]?.dismissedAt).toBeNull();
    }).toPass();
  });

  test("a milestone crossed more than a day ago, or dismissed, does not show", async ({
    launcher,
    backendSimulator,
  }) => {
    seedRead(backendSimulator, lasting(70));
    const library = await launcher.launchExpectingLibrary({
      milestones: {
        "30m": { crossedAt: hoursAgo(25), dismissedAt: null },
        "1h": { crossedAt: hoursAgo(2), dismissedAt: hoursAgo(1) },
      },
    });

    await library.verifyTimeSavedSays("1 hour 9 minutes");
    await library.milestones.verifyShowsNothing();
  });

  test("crossing several at once stacks them shortest first, and × brings the next forward", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seed(lasting(5 * 60 + 10));
    const library = await launcher.launchExpectingLibrary();

    await library.nthCard(0).clickMarkRead();

    await library.milestones.verifyCountReads("1 of 3 new milestones");
    await library.milestones.verifyFrontCardIs("30 minutes");
    await library.milestones.verifyDismissIsLabelled("Hide this milestone");

    await library.milestones.dismiss();
    await library.milestones.verifyCountReads("2 of 3 new milestones");
    await library.milestones.verifyFrontCardIs("1 hour");

    await library.milestones.dismiss();
    await library.milestones.verifyCountReads("3 of 3 new milestones");
    await library.milestones.verifyFrontCardIs("5 hours");
  });

  test("the card's lines can be stepped with the dots and the arrow keys", async ({ launcher, backendSimulator }) => {
    seedRead(backendSimulator, lasting(40));
    const library = await launcher.launchExpectingLibrary({ milestones: { "30m": { crossedAt: hoursAgo(1), dismissedAt: null } } });
    const lines = MILESTONE_LINES["30m"];

    await library.milestones.verifyLineReads(lines[0]!);
    await library.milestones.clickDot(2);
    await library.milestones.verifyLineReads(lines[2]!);
    await library.milestones.pressArrow("ArrowRight");
    await library.milestones.verifyLineReads(lines[3]!);
    await library.milestones.pressArrow("ArrowLeft");
    await library.milestones.verifyLineReads(lines[2]!);
  });

  test("a milestone hides again if unreading drops the total back below it", async ({
    launcher,
    backendSimulator,
  }) => {
    seedRead(backendSimulator, lasting(26));
    seedRead(backendSimulator, lasting(7));
    const library = await launcher.launchExpectingLibrary({ milestones: { "30m": { crossedAt: hoursAgo(1), dismissedAt: null } } });
    await library.milestones.verifyFrontCardIs("30 minutes");
    await library.showAll();

    await library.cardWithTitle("7 minute video").clickMarkRead();

    await library.milestones.verifyShowsNothing();
  });

  test("opening and closing the breakdown, stepping a card's lines, dismissing and undoing are counted", async ({
    launcher,
    backendSimulator,
  }) => {
    seedRead(backendSimulator, lasting(40));
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);

    await library.milestones.verifyFrontCardIs("30 minutes");
    await library.milestones.clickDot(2);
    await library.milestones.pressArrow("ArrowRight");
    await library.milestones.dismiss();
    await library.milestones.undo();
    await (await library.openTimeSaved()).close();

    await expect
      .poll(() => backendSimulator.analytics.events())
      .toEqual([
        { name: "timeSaved.milestoneCard.lineChosen", props: { milestone: "30m", by: "dot" } },
        { name: "timeSaved.milestoneCard.lineChosen", props: { milestone: "30m", by: "keys" } },
        { name: "timeSaved.milestoneCard.dismissed", props: { milestone: "30m" } },
        { name: "timeSaved.milestoneCard.dismissalUndone", props: { milestone: "30m" } },
        { name: "timeSaved.library.breakdownOpened", props: {} },
        { name: "timeSaved.library.breakdownClosed", props: {} },
      ]);
  });
});

test.describe("on the panel's home", () => {
  test("a milestone crossed in the last day shows under the offer", async ({ launcher, backendSimulator }) => {
    seedRead(backendSimulator, lasting(40));

    const capture = await launcher.launchPanel({ milestones: { "30m": { crossedAt: hoursAgo(1), dismissedAt: null } } });

    await capture.milestones.verifyFrontCardIs("30 minutes");
    await capture.milestones.verifyFigureSays("Time saved: 39 minutes");
  });

  test("a library already past a milestone with no mark records it and shows it", async ({
    launcher,
    backendSimulator,
  }) => {
    seedRead(backendSimulator, lasting(40));

    const capture = await launcher.launchPanel();

    await capture.milestones.verifyFrontCardIs("30 minutes");
    await expect(async () => {
      const settings = await backendSimulator.settingsStore.get();
      expect(settings.milestones["30m"]).toMatchObject({ dismissedAt: null });
    }).toPass();
  });

  test("any other day the home shows no card", async ({ launcher, backendSimulator }) => {
    seedRead(backendSimulator, lasting(11));

    const capture = await launcher.launchPanel();

    await capture.milestones.verifyShowsNothing();
    await capture.milestones.verifyNoCount();
  });
});

test.describe("in an overview", () => {
  test("marking it read brings in what it saved, and it stays", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(lasting(11));
    const library = await launcher.launchExpectingLibrary();
    const reader = await library.nthCard(0).openReader();
    await reader.verifyNoSavedChip();

    await reader.clickMarkRead();

    await reader.verifySavedChipSays("Saved you 10 min");
  });

  test("an overview already read shows nothing on arrival", async ({ launcher, backendSimulator }) => {
    seedRead(backendSimulator, lasting(11));
    const library = await launcher.launchExpectingLibrary();
    await library.showAll();

    const reader = await library.nthCard(0).openReader();

    await reader.verifyNoSavedChip();
  });
});

test.describe("in the panel's overview", () => {
  const WATCHED_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
  const watched = (minutes: number) => {
    const overview = lasting(minutes);
    return { ...overview, video: { ...overview.video, id: VideoId.parse(IWFT_VIDEO_ID), url: WATCHED_URL } };
  };

  test("Mark read beside Listen brings in what it saved, and the button says it is read", async ({
    launcher,
    backendSimulator,
  }) => {
    const overview = watched(11);
    backendSimulator.overviews.seed(overview);
    const capture = await launcher.launchPanel({ activeVideoUrl: WATCHED_URL });
    const reader = await capture.openStoredOverview();
    await reader.verifyPanelReadButtonReads("Mark read");
    await reader.verifyNoSavedChip();

    await reader.clickPanelMarkRead();

    await reader.verifyPanelReadButtonReads("Read");
    await reader.verifySavedChipSays("Saved you 10 min");
    await expect(async () => {
      const state = await backendSimulator.overviews.getState(overview.id);
      expect(state.read).toBe(true);
    }).toPass();
  });

  test("pressing it again marks the overview unread", async ({ launcher, backendSimulator }) => {
    const overview = watched(11);
    seedRead(backendSimulator, overview);
    const capture = await launcher.launchPanel({ activeVideoUrl: WATCHED_URL });
    const reader = await capture.openStoredOverview();
    await reader.verifyPanelReadButtonReads("Read");

    await reader.clickPanelMarkRead();

    await reader.verifyPanelReadButtonReads("Mark read");
    await reader.verifyNoSavedChip();
  });
});

test.describe("the verdict filter", () => {
  test("folds under More filters, which says what is set while closed", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(
      makeOverview({ verdict: { novelty: "original", standsOut: { text: "A new idea.", range: null }, dubious: true, reasoning: "x", similarTo: [] } }),
    );
    const library = await launcher.launchExpectingLibrary();
    await library.filterPanel.verifyVerdictIsFolded();
    await library.filterPanel.verifyMoreFiltersSummaryReads("Any verdict");

    await library.filterPanel.clickDubiousChip();

    await library.filterPanel.verifyMoreFiltersSummaryReads("Dubious only");
  });
});
