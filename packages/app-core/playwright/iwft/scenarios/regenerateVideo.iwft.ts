import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../../../src/features/overviews/types/TopicFactory.testHelper.js";
import { overviewActionsMenuTestIds } from "../../../src/features/reader/components/OverviewActionsMenu/OverviewActionsMenuTestIds.js";

const VIDEO_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const TOPIC = makeTopic({ name: "Work" });
const OLD = makeOverview({
  source: { ...makeOverview().source, id: VideoId.parse(IWFT_VIDEO_ID), url: VIDEO_URL, title: "The Simulated Video" },
  savedAt: "2026-01-02T03:04:05.000Z",
  captureReason: "For the Thursday meeting.",
  topicIds: [TOPIC.id],
  coreClaim: "The claim the old prompt wrote.",
});

// docs/features/one-overview-per-video.md, "Regenerating".
test("a video overview regenerates from its menu under the same id, keeping the reader's reason, topic, favourite and saved date", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seedTopic(TOPIC);
  backendSimulator.overviews.seed(OLD);
  backendSimulator.overviews.seedState({ overviewId: OLD.id, read: false, favourite: true, userTags: [] });
  const library = await launcher.launchExpectingLibrary({ apiKeys: ANTHROPIC_KEY });
  await library.nthCard(0).openReader();

  await page.getByTestId(overviewActionsMenuTestIds.trigger).click();
  await page.getByRole("menuitem", { name: "Regenerate", exact: true }).click();

  await expect
    .poll(async () => (await backendSimulator.overviewStore.listOverviews()).map((overview) => overview.coreClaim))
    .toEqual(["The simulated technique works because the fixture says so."]);
  const [made] = await backendSimulator.overviewStore.listOverviews();
  expect(made).toMatchObject({
    id: OLD.id,
    savedAt: OLD.savedAt,
    captureReason: "For the Thursday meeting.",
    topicIds: [TOPIC.id],
  });
  expect(await backendSimulator.overviews.getState(OLD.id)).toMatchObject({ favourite: true });
});

test("a regeneration that fails leaves the note as it was", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seedTopic(TOPIC);
  backendSimulator.overviews.seed(OLD);
  backendSimulator.simulateEndpointError(EndpointKey.ANTHROPIC_MESSAGES);
  const library = await launcher.launchExpectingLibrary({ apiKeys: ANTHROPIC_KEY });
  await library.nthCard(0).openReader();

  await page.getByTestId(overviewActionsMenuTestIds.trigger).click();
  await page.getByRole("menuitem", { name: "Regenerate", exact: true }).click();

  await launcher.appShell.generationStatusStrip.verifyHasFailed();
  expect(await backendSimulator.overviewStore.listOverviews()).toEqual([OLD]);
});
