import { test, expect } from "../../support/fixtures.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import {
  makeOverview,
  makeOverviewState,
} from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const titled = (title: string, tags: string[], savedAt: string) =>
  makeOverview({ video: { ...makeOverview().video, title, channel: "Starter Story" }, tags, savedAt });

const THIS_ONE = titled("This one", ["saas", "founder-interview", "pricing"], "2026-10-01T00:00:00.000Z");

const seedRelated = (backendSimulator: BackendSimulator, count: number) => {
  backendSimulator.overviews.seed(THIS_ONE);
  for (let index = 0; index < count; index += 1) {
    backendSimulator.overviews.seed(
      titled(`Related ${index}`, ["saas"], `2026-09-${String(10 + index)}T00:00:00.000Z`),
    );
  }
};

test("the note ends with its tags and the overviews sharing most of them, newest first among equals", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(THIS_ONE);
  backendSimulator.overviews.seed(titled("Shares one", ["pricing"], "2026-09-20T00:00:00.000Z"));
  backendSimulator.overviews.seed(titled("Shares two", ["saas", "pricing"], "2026-09-01T00:00:00.000Z"));
  backendSimulator.overviews.seed(titled("Shares none", ["energy"], "2026-09-25T00:00:00.000Z"));
  const read = titled("Shares one, read", ["saas"], "2026-09-10T00:00:00.000Z");
  backendSimulator.overviews.seed(read);
  backendSimulator.overviews.seedState(makeOverviewState(read.id, { read: true }));
  await launcher.launch();

  await launcher.openPage(Routes.overview(THIS_ONE.id));
  const related = launcher.readerPage.relatedByTag;

  await related.verifyHeadingReads("Related by tag");
  await related.verifyTagsRead(["#saas", "#founder-interview", "#pricing"]);
  await related.verifyRelatedRead([
    "Shares twoStarter Story",
    "Shares oneStarter Story",
    "Shares one, readStarter Story · Read",
  ]);
});

test("three show at first and the rest wait behind Show more, which keeps focus as it becomes Show fewer", async ({
  launcher,
  backendSimulator,
}) => {
  seedRelated(backendSimulator, 10);
  await launcher.launch();
  await launcher.openPage(Routes.overview(THIS_ONE.id));
  const related = launcher.readerPage.relatedByTag;

  await related.verifyRelatedRead(["Related 9Starter Story", "Related 8Starter Story", "Related 7Starter Story"]);
  await related.showMore("Show 5 more");

  await related.verifyShowMoreIsFocused("Show fewer");
  await related.verifyRelatedRead(
    ["Related 9", "Related 8", "Related 7", "Related 6", "Related 5", "Related 4", "Related 3", "Related 2"].map(
      (title) => `${title}Starter Story`,
    ),
  );
});

test("a tag opens the library filtered to it, and a related overview opens in the reader", async ({
  launcher,
  backendSimulator,
}) => {
  seedRelated(backendSimulator, 1);
  await launcher.launch(SIGNED_IN);
  await launcher.openPage(Routes.overview(THIS_ONE.id));

  const reader = await launcher.readerPage.relatedByTag.openRelated("Related 0");
  await reader.verifyTitle("Related 0");

  const library = await reader.relatedByTag.followTag("saas");
  await library.verifyChipsRead(["#saas", "Read and unread"]);
  await library.verifyCountReads("2 overviews tagged #saas · 2 unread");
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name.startsWith("reader.relatedByTag.")))
    .toEqual([
      { name: "reader.relatedByTag.overviewOpened", props: { overviewId: THIS_ONE.id, sharedTags: 1 } },
      { name: "reader.relatedByTag.tagFollowed", props: { overviewId: expect.any(String) } },
    ]);
});

test("with nothing related the tags stay, still linking, under a Tags label", async ({ launcher, backendSimulator }) => {
  seedRelated(backendSimulator, 0);
  await launcher.launch();
  await launcher.openPage(Routes.overview(THIS_ONE.id));
  const related = launcher.readerPage.relatedByTag;

  await related.verifyHeadingReads("Tags");
  await related.verifyNoRelated();
  const library = await related.followTag("pricing");
  await library.verifyCountReads("1 overview tagged #pricing · 1 unread");
});

test("a note with no tags has no section at all", async ({ launcher, backendSimulator }) => {
  const untagged = titled("Untagged", [], "2026-10-01T00:00:00.000Z");
  backendSimulator.overviews.seed(untagged);
  await launcher.launch();
  await launcher.openPage(Routes.overview(untagged.id));

  await launcher.readerPage.relatedByTag.verifyNoSection();
});

test("in the side panel the tags are words, since there is no library to land in, and related overviews still open", async ({
  launcher,
  backendSimulator,
}) => {
  seedRelated(backendSimulator, 1);
  await launcher.launchPanel({ activeVideoUrl: null });
  await launcher.openPage(Routes.overview(THIS_ONE.id));
  const related = launcher.readerPage.relatedByTag;

  await related.verifyTagsRead(["#saas", "#founder-interview", "#pricing"]);
  await related.verifyNoTagLinks();
  const reader = await related.openRelated("Related 0");
  await reader.verifyTitle("Related 0");
});
