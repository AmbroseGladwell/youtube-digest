import { ShareToken, shareSnapshot } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { Routes } from "../../../src/app/Routes.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL, firstName: "Ada" },
};

const LINK_FIELD = {
  autocomplete: "off",
  inputmode: "url",
  autocapitalize: "none",
  autocorrect: "off",
  spellcheck: "false",
};

const EMAIL_FIELD = {
  type: "email",
  autocomplete: "email",
  inputmode: "email",
  autocapitalize: "none",
  autocorrect: "off",
  spellcheck: "false",
};

test("the first-run link field and the new overview dialog name their fields", async ({ launcher }) => {
  const home = await launcher.launch();
  await home.verifyFieldsIdentifyThemselves();
  await home.verifyFieldAttributes("video-url", LINK_FIELD);

  const dialog = await launcher.appShell.openNewOverview();

  await dialog.verifyFieldsIdentifyThemselves();
  await dialog.verifyFieldAttributes("video-url", LINK_FIELD);
});

test("the reason asked for during a run names its field", async ({ launcher, backendSimulator }) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: { anthropicApiKey: "sk-ant-test" } });
  const dialog = launcher.appShell.newOverviewDialog;

  await form.submitUrl(`https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`);
  await dialog.verifyStepState("02", "running");

  await dialog.verifyFieldsIdentifyThemselves();
  await dialog.verifyFieldAttributes("capture-reason", { autocomplete: "off" });
});

test("signing in offers saved addresses and keeps phones from capitalising them", async ({ launcher }) => {
  await launcher.launch({ sync: true });
  const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();

  await signIn.verifyFieldsIdentifyThemselves();
  await signIn.verifyFieldAttributes("email", EMAIL_FIELD);
});

test("creating an account offers the reader's saved first name and address", async ({ launcher }) => {
  await launcher.launch({ sync: true });
  const createAccount = await (await launcher.appShell.accountMenu.open()).chooseCreateAccount();

  await createAccount.verifyFieldsIdentifyThemselves();
  await createAccount.verifyFieldAttributes("given-name", { autocomplete: "given-name" });
  await createAccount.verifyFieldAttributes("email", EMAIL_FIELD);
});

test("the code field asks the phone to offer the code from the message", async ({ launcher }) => {
  await launcher.launch({ sync: true });
  const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();
  await signIn.requestLink(SIMULATED_EMAIL);
  await signIn.chooseCodeFromEmail();

  await signIn.verifyFieldsIdentifyThemselves();
  await signIn.verifyFieldAttributes("one-time-code", { autocomplete: "one-time-code" });
});

test("the extension's server address is a link field with no suggestions, beside the email and the code", async ({
  launcher,
}) => {
  await launcher.launch({ sync: true, surface: "extension" });
  const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();
  await signIn.verifyFieldsIdentifyThemselves();
  await signIn.verifyFieldAttributes("server-url", LINK_FIELD);

  await signIn.chooseCodeFromWebApp();

  await signIn.verifyFieldsIdentifyThemselves();
  await signIn.verifyFieldAttributes("server-url", LINK_FIELD);
});

test("the Anthropic key is kept away from password managers", async ({ launcher }) => {
  await launcher.launch();
  const settings = await (await launcher.appShell.openSettings()).openSection("keys");

  await settings.verifyFieldsIdentifyThemselves();
  await settings.verifyFieldAttributes("anthropic-api-key", {
    autocomplete: "off",
    "data-1p-ignore": "true",
    "data-lpignore": "true",
    "data-bwignore": "true",
  });
});

test("the playlist link field is a link field", async ({ launcher }) => {
  await launcher.launch();
  const settings = await (await launcher.appShell.openSettings()).openSection("playlists");

  await settings.verifyFieldsIdentifyThemselves();
  await settings.verifyFieldAttributes("playlist-url", LINK_FIELD);
});

test("the library's search and the new topic dialog name their fields", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview());
  const library = await launcher.launchExpectingLibrary();
  await library.verifyFieldsIdentifyThemselves();
  await library.verifyFieldAttributes("library-search", { autocomplete: "off", enterkeyhint: "search" });

  const dialog = await library.openNewTopic();

  await dialog.verifyFieldsIdentifyThemselves();
  await dialog.verifyFieldAttributes("topic-name", { autocomplete: "off" });
});

test("the reader's topic, reason and transcript fields name themselves", async ({ launcher, backendSimulator }) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed(overview);
  backendSimulator.transcripts.seed(makeStoredTranscript({ videoId: overview.video.id! }));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.editTopics();
  await reader.verifyFieldsIdentifyThemselves();
  await reader.verifyFieldAttributes("topic-search", { autocomplete: "off" });

  await reader.editReason();
  await reader.verifyFieldsIdentifyThemselves();
  await reader.verifyFieldAttributes("capture-reason", { autocomplete: "off" });

  await reader.clickTab("Transcript");
  await reader.verifyFieldsIdentifyThemselves();
  await reader.verifyFieldAttributes("transcript-search", { autocomplete: "off", enterkeyhint: "search" });
});

test("the share link names itself", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview());
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();
  const dialog = await reader.clickShare();

  await dialog.clickCreateLink();

  await dialog.verifyFieldsIdentifyThemselves();
  await dialog.verifyFieldAttributes("share-url", { autocomplete: "off" });
});

test("the shared page's own link field is a link field", async ({ launcher }) => {
  const overview = makeOverview();
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload({
    state: "shared",
    token: ShareToken.parse("k7Qm2x9RfTabcdef"),
    sharedAt: "2026-09-30T11:00:00.000Z",
    snapshot: shareSnapshot({ overview, transcript: null, narration: null }),
  });
  await launcher.openPage(Routes.sharedOverview(ShareToken.parse("k7Qm2x9RfTabcdef")));

  const page = await launcher.sharedOverviewPage.verifyIsShown();

  await page.verifyFieldsIdentifyThemselves();
  await page.verifyFieldAttributes("video-url", LINK_FIELD);
});

test("the signed-out library's link field is a link field", async ({ launcher }) => {
  await launcher.launch({
    sync: true,
    deviceAccountHistory: { signedOutHere: true },
    apiKeys: { anthropicApiKey: "sk-ant-test" },
  });

  await launcher.signedOutLibrary.verifyIsShown();

  await launcher.signedOutLibrary.verifyFieldsIdentifyThemselves();
  await launcher.signedOutLibrary.verifyFieldAttributes("video-url", LINK_FIELD);
});
