import type { ConnectionRequest, Overview } from "@overview/domain";
import { expect, test } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";

const REQUEST_ID = "0b8f5f7e-3c1d-4a8e-9b2a-6f1e2d3c4b5a";
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const request: ConnectionRequest = {
  id: REQUEST_ID,
  clientName: "Claude",
  redirectHost: "claude.ai",
  expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
};

test("a screen that throws while it renders is reported, with what the reader did before it", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = makeOverview();
  const broken = makeOverview({
    video: { ...overview.video, title: "My notes on the divorce" },
    tags: [{}] as unknown as Overview["tags"],
  });
  backendSimulator.overviews.seed(broken);
  backendSimulator.connections.seedRequest(request);
  backendSimulator.auth.accountIsOn("plus");
  await launcher.launch(SIGNED_IN);
  await launcher.openConsent(REQUEST_ID);
  await launcher.consentPage.verifyIsShown();

  await launcher.openPage(Routes.overview(broken.id));

  await launcher.errorState.verifyIsShown();
  await expect
    .poll(() => backendSimulator.errors.reported())
    .toEqual([
      expect.objectContaining({
        source: "routeBoundary",
        type: "Error",
        handled: false,
        trail: [{ name: "mcp.consentScreen.shown", at: expect.any(String) }],
      }),
    ]);
  const [reported] = backendSimulator.errors.reported();
  expect(reported!.frames.length).toBeGreaterThan(0);
  expect(JSON.stringify(reported)).not.toContain("divorce");
  expect(backendSimulator.errors.batches()[0]!.context).toMatchObject({ surface: "web", layout: "full" });
});

test("a reader with no account who hits a dead end has it reported too", async ({ launcher, backendSimulator }) => {
  await launcher.launchExpectingDeadEnd({ failingReads: ["overviews"] });

  await expect
    .poll(() => backendSimulator.errors.reported())
    .toEqual([
      expect.objectContaining({
        source: "errorState",
        message: "the overviews read was told to fail",
        handled: true,
        trail: [],
      }),
    ]);
  expect(backendSimulator.analytics.eventNames()).toEqual([]);
});

test("a call the server refused is reported with the id it was sent under, so the server's log of it can be found", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointError(EndpointKey.SESSION_LINK_CODE);
  await launcher.launch(SIGNED_IN);

  await (await launcher.appShell.accountMenu.open()).chooseConnectExtension();

  await launcher.errorState.verifyIsShown();
  await expect
    .poll(() => backendSimulator.errors.reported())
    .toEqual([
      expect.objectContaining({
        source: "failedRequest",
        type: "SyncRequestError",
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        apiErrorCode: "unavailable",
        status: 503,
      }),
    ]);
});

test("an error the tracker couldn't take never reaches the reader", async ({ launcher, backendSimulator }) => {
  backendSimulator.simulateEndpointError(EndpointKey.ERRORS);

  const deadEnd = await launcher.launchExpectingDeadEnd({ failingReads: ["overviews"] });

  await deadEnd.verifyTitleReads("Couldn't load your library");
  expect(backendSimulator.errors.reported()).toEqual([]);
});

test("the extension hands its worker where errors go and the session, and takes the session back on sign-out", async ({
  launcher,
}) => {
  await launcher.launch({
    sync: true,
    surface: "extension",
    defaultApiUrl: "https://theoverviewapp.test",
    syncConnection: { ...SIGNED_IN.syncConnection, token: "simulated-bearer" },
    errorDestinationMirror: true,
  });
  await expect
    .poll(() => launcher.readErrorDestinations())
    .toEqual([{ apiUrl: "https://sync.test", token: "simulated-bearer" }]);

  await (await launcher.appShell.accountMenu.open()).chooseSignOut();

  await expect
    .poll(async () => (await launcher.readErrorDestinations()).at(-1))
    .toEqual({ apiUrl: "https://theoverviewapp.test", token: null });
});
