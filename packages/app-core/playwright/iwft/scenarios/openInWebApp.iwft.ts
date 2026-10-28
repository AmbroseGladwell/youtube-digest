import { CURRENT_SCHEMA_VERSIONS, VideoId, type Overview } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const VIDEO_URL = "https://www.youtube.com/watch?v=webAppVideo01";
const API_KEYS = ANTHROPIC_KEY;
const SERVER = "https://sync.test";

const panel = { apiKeys: API_KEYS, activeVideoUrl: VIDEO_URL };
const signedIn = {
  ...panel,
  sync: true,
  syncConnection: { apiUrl: SERVER, token: "session-token", email: SIMULATED_EMAIL },
};

const seedNote = (backendSimulator: BackendSimulator): Overview => {
  const overview = makeOverview();
  const note = { ...overview, video: { ...overview.video, id: VideoId.parse("webAppVideo01"), url: VIDEO_URL } };
  backendSimulator.overviews.seed(note);
  return note;
};

const alreadyOnTheServer = (backendSimulator: BackendSimulator, overview: Overview) =>
  backendSimulator.sync.seedChange({
    kind: "overview",
    id: overview.id,
    schemaVersion: CURRENT_SCHEMA_VERSIONS.overview,
    rev: 1,
    seq: 1,
    updatedAt: "2026-09-26T08:30:00.000Z",
    deleted: false,
    body: overview,
  });

test("a note the server holds opens in the web app, at its own address there", async ({
  launcher,
  backendSimulator,
}) => {
  const note = seedNote(backendSimulator);
  alreadyOnTheServer(backendSimulator, note);
  const capture = await launcher.launchPanel(signedIn);
  const reader = await capture.openStoredOverview();

  await reader.verifyOpensInWebAppAt(`${SERVER}/overviews/${note.id}`);
});

test("a note that has not synced yet says so rather than opening a page that isn't there", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(signedIn);
  const reader = await capture.openStoredOverview();

  await reader.verifyCannotOpenInWebApp("Not in the web app until it syncs");
});

test("a shell that cannot sync offers no web app at all", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();

  await reader.verifyMenuHasNoOpenInWebApp();
});
