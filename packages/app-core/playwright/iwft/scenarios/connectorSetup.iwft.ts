import type { Connection, FollowUpQuestion } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SERVER = "https://sync.test";
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: SERVER, token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const QUESTIONS: FollowUpQuestion[] = [
  { question: "Why does intuition matter most where there is no rapid feedback?", forReader: false },
  { question: "What are slop grenades, and how do they shift the cost of AI work?", forReader: false },
];

const connectionsEvents = (events: Array<{ name: string; props: Record<string, unknown> }>) =>
  events.filter(({ name }) => name.startsWith("mcp.settingsConnections.")).map(({ name, props }) => ({ name, props }));

test.describe("Settings › Connections: which assistant (OV-301)", () => {
  test("choosing Claude shows only Claude's three steps, the address first", async ({ launcher }) => {
    await launcher.launch(SIGNED_IN);
    const settings = await (await launcher.appShell.openSettings()).openSection("connections");
    await settings.connections.verifyAsksWhichAssistant();

    await settings.connections.chooseAssistant("claude");

    await settings.connections.verifyAssistantChosen("claude");
    await settings.connections.verifyStepsRead([
      "Copy the address.",
      "In Claude, open Settings › Connectors and add a custom connector. Paste the address.",
      "Sign in to The Overview when Claude asks, and allow it.",
    ]);
    await settings.connections.verifyAddressIs(`${SERVER}/mcp`);
    await settings.connections.verifyLimitReads(null);
  });

  test("ChatGPT's steps carry its form, with the values to copy and the icon to download, and no plan warning", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await launcher.launch(SIGNED_IN);
    const settings = await (await launcher.appShell.openSettings()).openSection("connections");

    await settings.connections.chooseAssistant("chatgpt");

    await settings.connections.verifyLimitReads(null);
    await settings.connections.verifyStepsRead([
      "In ChatGPT, turn on Developer mode, then create a connector.",
      "Fill in the form:",
      "Open Advanced OAuth settings:",
      "Tick the notice about custom servers, then Create.",
      "Sign in to The Overview when ChatGPT asks, and allow it.",
    ]);
    await settings.connections.verifyFieldsRead([
      "Icon256 px PNG",
      "NameThe Overview",
      "DescriptionYour overviews and their transcripts",
      `MCP server URL${SERVER}/mcp`,
      "AuthenticationOAuth",
      "Registration methodDynamic Client RegistrationCIMD and OIDC show as unavailable. That’s expected.",
      "Default scopesAll three",
      "Base scopesLeave empty",
      "EndpointsLeave as found",
    ]);
    await settings.connections.verifyIconDownloadsFrom(`${SERVER}/connector-icon.png`);

    await settings.connections.copyField("name");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("The Overview");
    await expect
      .poll(() => connectionsEvents(backendSimulator.analytics.events()))
      .toEqual([
        { name: "mcp.settingsConnections.assistantChosen", props: { assistant: "chatgpt" } },
        { name: "mcp.settingsConnections.fieldCopied", props: { field: "name" } },
      ]);
  });

  test("Gemini says plainly who can connect it, and Other gets the address alone", async ({ launcher }) => {
    await launcher.launch(SIGNED_IN);
    const settings = await (await launcher.appShell.openSettings()).openSection("connections");

    await settings.connections.chooseAssistant("gemini");
    await settings.connections.verifyLimitReads(
      "Gemini’s custom apps are only for Google AI Pro or Ultra, in the US, for over-18s. We haven’t tested it with The Overview yet.",
    );
    await settings.connections.verifyStepsRead([
      "Copy the address.",
      "In Gemini, open Settings › Connected apps › Add a custom app. Paste the address.",
      "Sign in to The Overview when Gemini asks, and allow it.",
    ]);

    await settings.connections.chooseAssistant("other");
    await settings.connections.verifyStepsRead([]);
    await settings.connections.verifyAddressIs(`${SERVER}/mcp`);
  });

  test("the assistant chosen under a question arrives picked, and choosing here changes where questions open", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seed(makeOverview({ followUpQuestions: QUESTIONS }));
    const library = await launcher.launchExpectingLibrary({ ...SIGNED_IN, followUpAssistant: "gemini" });
    const settings = await (await launcher.appShell.openSettings()).openSection("connections");
    await settings.connections.verifyAssistantChosen("gemini");

    await settings.connections.chooseAssistant("chatgpt");

    await launcher.appShell.clickBrand();
    const reader = await library.nthCard(0).openReader();
    await reader.followUps.verifyLineReads("Each opens ChatGPT in a new tab with this note filled in. Change");
  });

  test("arriving from a question's Set up a connection says what happens next, naming the assistant once picked", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seed(makeOverview({ followUpQuestions: QUESTIONS }));
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.followUps.clickQuestion(0);

    await reader.followUps.followSetUpConnection();

    const connections = launcher.settingsPage.connections;
    await connections.verifyArrivalNoteReads("Pick your assistant and connect it, then go back to your question.");
    await connections.chooseAssistant("chatgpt");
    await connections.verifyArrivalNoteReads("Connect ChatGPT, then go back to your question. It’ll open in ChatGPT, connected.");
  });

  test("arriving connected to the assistant already, there's no note", async ({ launcher, backendSimulator }) => {
    const claude: Connection = {
      id: "claude",
      clientName: "Claude",
      createdAt: "2026-11-01T12:00:00.000Z",
      lastUsedAt: "2026-11-14T12:00:00.000Z",
      readsProfile: true,
      writes: true,
    };
    backendSimulator.connections.seed(claude);
    await launcher.launch({ ...SIGNED_IN, followUpAssistant: "claude" });
    const settings = await (await launcher.appShell.openSettings()).openSection("connections");

    await settings.connections.verifyArrivalNoteReads(null);
  });

  test("Personalisation points to Connections for where questions open", async ({ launcher }) => {
    await launcher.launch(SIGNED_IN);
    const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");

    await settings.personalisation.verifyFollowUpAssistantNoteReads("Questions open in the assistant you choose in Connections.");
    await settings.personalisation.followConnectionsLink();

    await launcher.settingsPage.connections.verifyAsksWhichAssistant();
  });
});
