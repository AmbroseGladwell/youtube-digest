import type { Connection } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";

const SERVER = "https://sync.test";
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: SERVER, token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const PLUS = { ...SIGNED_IN, plan: "plus" as const };
const PHONE = { width: 390, height: 800 };

const connection = (overrides: Partial<Connection> = {}): Connection => ({
  id: "claude",
  clientName: "Claude",
  createdAt: "2026-09-12T12:00:00.000Z",
  lastUsedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  ...overrides,
});

test.describe("Settings › Connections", () => {
  test("lists the assistants connected, when each connected and was last used, and how to add another", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.connections.seed(connection());
    backendSimulator.connections.seed(
      connection({ id: "unnamed", clientName: null, createdAt: "2026-09-03T12:00:00.000Z", lastUsedAt: "2026-09-14T12:00:00.000Z" }),
    );
    await launcher.launch(PLUS);
    const settings = await launcher.appShell.openSettings();
    await settings.verifyRowReads("connections", "2 connected");

    await settings.openSection("connections");

    await settings.connections.verifyListsConnections(["Claude", "No name given"]);
    await settings.connections.verifyUseLineReads(0, "Connected 12 September · Used in the last hour");
    await settings.connections.verifyUseLineReads(1, "Connected 3 September · Last used 14 September");
    await settings.connections.verifyShowsSetup(`${SERVER}/mcp`);
    await settings.connections.verifyOffersExamples(false);
    await settings.verifySectionHeadingIsFocused("connections");
  });

  test("revoking asks once, and keeping it puts the row back with focus on its Revoke", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.connections.seed(connection());
    await launcher.launch(PLUS);
    const settings = await (await launcher.appShell.openSettings()).openSection("connections");

    await settings.connections.startRevoking("Claude");
    await settings.connections.verifyConfirmReads("Revoke “Claude”?");
    await settings.connections.keep();

    await settings.connections.verifyRevokeIsFocused("Claude");
    test.expect(backendSimulator.connections.revoked()).toEqual([]);
  });

  test("revoking access removes the row at once and tells the server", async ({ launcher, backendSimulator }) => {
    backendSimulator.connections.seed(connection());
    backendSimulator.connections.seed(connection({ id: "other", clientName: "Other" }));
    await launcher.launch(PLUS);
    const settings = await (await launcher.appShell.openSettings()).openSection("connections");

    await settings.connections.startRevoking("Claude");
    await settings.connections.confirmRevoke();

    await settings.connections.verifyListsConnections(["Other"]);
    await settings.connections.verifyConnectedLabelIsFocused();
    await settings.verifyRowReads("connections", "1 connected");
    test.expect(backendSimulator.connections.revoked()).toEqual(["claude"]);
    await test
      .expect.poll(() => backendSimulator.analytics.eventNames().filter((name) => name.startsWith("mcp.")))
      .toEqual(["mcp.settingsConnections.revokeAsked", "mcp.settingsConnections.revoked"]);
  });

  test("a revoke the server refused puts the row back and says so", async ({ launcher, backendSimulator }) => {
    backendSimulator.connections.seed(connection());
    backendSimulator.simulateEndpointError(EndpointKey.CONNECTION_REVOKE);
    await launcher.launch(PLUS);
    const settings = await (await launcher.appShell.openSettings()).openSection("connections");

    await settings.connections.startRevoking("Claude");
    await settings.connections.confirmRevoke();

    await settings.connections.verifyErrorShown();
    await settings.connections.verifyListsConnections(["Claude"]);
  });

  test("with nothing connected, setup leads, with questions to try", async ({ launcher, page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await launcher.launch(PLUS);
    const settings = await (await launcher.appShell.openSettings()).openSection("connections");

    await settings.connections.verifyListsConnections([]);
    await settings.connections.verifyShowsSetup(`${SERVER}/mcp`);
    await settings.connections.verifyOffersExamples(true);

    await settings.connections.copyAddress();
    await settings.connections.verifyCopied();
    test.expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${SERVER}/mcp`);
  });

  test("on Free, it says what a connection does and offers Plus, with no address or steps", async ({ launcher }) => {
    test.skip(true, "every account can connect an assistant until billing exists (OV-18)");
    await launcher.launch(SIGNED_IN);
    const settings = await launcher.appShell.openSettings();
    await settings.verifyRowReads("connections", "Needs Plus");

    await settings.openSection("connections");

    await settings.connections.verifyOffersPlus();
  });

  test("on Free, it lists connections and shows the address while every account can connect", async ({ launcher }) => {
    await launcher.launch(SIGNED_IN);
    const settings = await launcher.appShell.openSettings();
    await settings.verifyRowReads("connections", "None");

    await settings.openSection("connections");

    await settings.connections.verifyListsConnections([]);
    await settings.connections.verifyShowsSetup(`${SERVER}/mcp`);
  });

  test("signed out, it asks to sign in first", async ({ launcher }) => {
    await launcher.launch({ sync: true });
    const settings = await launcher.appShell.openSettings();
    await settings.verifyRowReads("connections", "Sign in first");

    await settings.openSection("connections");

    await settings.connections.verifyAsksToSignIn();
  });

  test("an account that couldn't be checked says so and can be asked again", async ({ launcher, backendSimulator }) => {
    backendSimulator.connections.seed(connection());
    backendSimulator.simulateEndpointError(EndpointKey.SESSION_READ);
    await launcher.launch(PLUS);
    const settings = await (await launcher.appShell.openSettings()).openSection("connections");

    await settings.connections.verifyErrorShown();
    backendSimulator.simulateEndpointDefault(EndpointKey.SESSION_READ);
    await settings.connections.tryAgain();

    await settings.connections.verifyListsConnections(["Claude"]);
  });

  test("a session the server no longer knows asks to sign in first", async ({ launcher, backendSimulator }) => {
    backendSimulator.auth.sessionHasLapsed();
    await launcher.launch(PLUS);
    const settings = await launcher.appShell.openSettings();
    await settings.verifyRowReads("connections", "Sign in first");
    await settings.openSection("connections");

    await settings.connections.verifyAsksToSignIn();
  });

  test("in a shell that cannot sync, there is no Connections section at all", async ({ launcher }) => {
    await launcher.launch({ sync: false });
    const settings = await launcher.appShell.openSettings();

    await settings.verifyRowsAre(["keys", "milestones", "plan"]);
  });

  test("the Plus panel's connection line opens the section", async ({ launcher }) => {
    await launcher.launch(PLUS);
    const settings = await (await launcher.appShell.openSettings()).openSection("plan");

    await settings.connections.openFromPlusPanel();

    await settings.verifySectionIsShown("connections");
  });

  test("on a phone, the section is a page of its own", async ({ launcher, backendSimulator, page }) => {
    await page.setViewportSize(PHONE);
    backendSimulator.connections.seed(connection());
    await launcher.launch(PLUS);

    await launcher.openPage(Routes.settingsSection("connections"));

    await launcher.settingsPage.verifyListIsShown(false);
    await launcher.settingsPage.connections.verifyListsConnections(["Claude"]);
  });

  test("in the extension panel, signed in on Plus, it lists connections too", async ({ launcher, backendSimulator }) => {
    backendSimulator.connections.seed(connection());
    await launcher.launchPanel({
      sync: true,
      syncConnection: { apiUrl: SERVER, token: "session-token", email: SIMULATED_EMAIL },
      plan: "plus",
    });
    const settings = await (await launcher.appShell.openSettings()).openSection("connections");

    await settings.connections.verifyListsConnections(["Claude"]);
  });
});
