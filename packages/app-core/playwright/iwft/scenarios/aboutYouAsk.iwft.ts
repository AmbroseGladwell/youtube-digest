import { ABOUT_YOU_SECTIONS, type ExtractedArticle } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import type { AxeAllowance } from "../../pageObjects/PageObject.testHelper.js";
import { aboutYouSentenceTestIds } from "../../../src/features/settings/components/AboutYouSentence/AboutYouSentenceTestIds.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";

const ASKED = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
  aboutYouAskedAfterOnboarding: false,
};
const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const PHONE = { width: 390, height: 844 };
const ARTICLE: ExtractedArticle = {
  url: "https://theharbourpost.example/2026/11/bridge-bill-twice",
  title: "The town that pays its bridge bill twice",
  siteName: "The Harbour Post",
  author: null,
  publishedAt: null,
  language: "en",
  imageUrl: null,
  sections: [{ heading: null, anchor: null, text: "The county reused a survey from 2011.", links: [] }],
  wordCount: 3220,
  recipe: null,
};
// Each section is named by its spoken sentence (OV-389), as onboarding and Settings are.
const ALLOWED: AxeAllowance[] = ABOUT_YOU_SECTIONS.map((section) => ({
  rule: "label-content-name-mismatch",
  testId: aboutYouSentenceTestIds.section(section),
}));

const askEvents = (backendSimulator: BackendSimulator) =>
  backendSimulator.analytics.events().filter(({ name }) => name.startsWith("capture.aboutYouAsk."));

const flag = async (backendSimulator: BackendSimulator) => (await backendSimulator.settingsStore.get()).aboutYouAskedAfterOnboarding;

test("on the web the + New dialog becomes About you before writing, and Continue writes the overview with the answer", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(ASKED);
  const dialog = await launcher.appShell.openNewOverview();
  const ask = launcher.aboutYouAsk;

  await dialog.form.submitUrl(VALID_URL);
  await ask.verifyOpensOnItsTitle();
  await ask.verifyWaiting("For this video", "The Simulated Video");
  await ask.verifyNamedAndDescribed();
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);

  await ask.sentence.openSection("who");
  await ask.sentence.pick("dad");
  await ask.sentence.done();
  await ask.verifyIsShown();
  await ask.clickContinue();

  await ask.verifyIsHidden();
  await dialog.verifyIsShown();
  await expect.poll(() => backendSimulator.ourKey.generations().length).toBe(1);
  expect(backendSimulator.ourKey.generations()[0]?.input.readerContext).toBe("I'm a dad.");
  await dialog.verifyStatusReads(/^Overview written · \d+ min read$/);
  await expect.poll(() => flag(backendSimulator)).toBe(true);
  await expect
    .poll(() => askEvents(backendSimulator))
    .toEqual([
      { name: "capture.aboutYouAsk.shown", props: { plan: "free", from: "dialog", sourceKind: "video" } },
      {
        name: "capture.aboutYouAsk.continued",
        props: { plan: "free", from: "dialog", sourceKind: "video", who: 1, time: 0, focus: 0, typed: 0 },
      },
    ]);
  expect(JSON.stringify(askEvents(backendSimulator))).not.toContain("dad");
});

test("while it waits the row says so, and once filled in it is marked Personalised as it writes", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.simulateEndpointStalled(EndpointKey.OUR_KEY_GENERATE);
  await launcher.launch(ASKED);
  const dialog = await launcher.appShell.openNewOverview();
  const ask = launcher.aboutYouAsk;

  await dialog.form.submitUrl(VALID_URL);
  await ask.verifyIsShown();
  await ask.sentence.openSection("who");
  await ask.sentence.pick("dad");
  await ask.sentence.done();
  await ask.clickContinue();

  await ask.verifyRowPersonalised();
  await backendSimulator.releaseEndpoint(EndpointKey.OUR_KEY_GENERATE);
  await dialog.verifyStatusReads(/^Overview written · \d+ min read$/);
});

test("Skip writes the overview without it, and it is never asked again", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(ASKED);
  const dialog = await launcher.appShell.openNewOverview();
  const ask = launcher.aboutYouAsk;

  await dialog.form.submitUrl(VALID_URL);
  await ask.verifyIsShown();
  await ask.clickSkip();

  await dialog.verifyStatusReads(/^Overview written · \d+ min read$/);
  expect(backendSimulator.ourKey.generations()[0]?.input.readerContext).toBeNull();
  await expect.poll(() => flag(backendSimulator)).toBe(true);
  await expect
    .poll(() => askEvents(backendSimulator).at(-1))
    .toEqual({
      name: "capture.aboutYouAsk.skipped",
      props: { plan: "free", from: "dialog", sourceKind: "video", how: "skip" },
    });

  backendSimulator.articles.answerWith({ status: "read", article: ARTICLE });
  await dialog.form.submitUrl(ARTICLE.url);
  await expect.poll(() => backendSimulator.ourKey.generations().length).toBe(2);
  await ask.verifyIsHidden();
});

test("Escape is Skip too, counted as how it was closed", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(ASKED);
  const dialog = await launcher.appShell.openNewOverview();
  const ask = launcher.aboutYouAsk;

  await dialog.form.submitUrl(VALID_URL);
  await ask.verifyIsShown();
  await ask.sheet.pressEscape();

  await ask.verifyIsHidden();
  await expect.poll(() => backendSimulator.ourKey.generations().length).toBe(1);
  await expect.poll(() => askEvents(backendSimulator).at(-1)?.props).toMatchObject({ how: "escape" });
  await expect.poll(() => flag(backendSimulator)).toBe(true);
});

test("a recipe video is never asked about: its kind is checked first, once, and the writer is told it", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.setGeneratedOutputOverrides({ recipe: true });
  await launcher.launch(ASKED);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);

  await expect.poll(() => backendSimulator.ourKey.generations().length).toBe(1);
  expect(backendSimulator.ourKey.generations()[0]?.input).toHaveProperty("noteKind", "recipe");
  expect(backendSimulator.ourKey.kindChecks()).toBe(1);
  await launcher.aboutYouAsk.verifyIsHidden();
  expect(askEvents(backendSimulator)).toEqual([]);
  expect(await flag(backendSimulator)).toBe(false);
});

test("a reader whose About you is filled in is never asked, and nothing is checked early", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch({ ...ASKED, aboutYou: { who: ["nurse"], time: [], focus: [] } });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);

  await dialog.verifyStatusReads(/^Overview written · \d+ min read$/);
  await launcher.aboutYouAsk.verifyIsHidden();
  expect(backendSimulator.ourKey.kindChecks()).toBe(0);
});

test("on a phone it is the bottom sheet, its foot fixed, and dragging it away is Skip", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await page.setViewportSize(PHONE);
  await launcher.launch(ASKED);
  const dialog = await launcher.appShell.openNewOverview();
  const ask = launcher.aboutYouAsk;

  await dialog.form.submitUrl(VALID_URL);
  await ask.verifyIsShown();
  await ask.verifyIsAccessible(ALLOWED);
  await ask.sheet.dragHandle(400, 120);

  await ask.verifyIsHidden();
  await expect.poll(() => backendSimulator.ourKey.generations().length).toBe(1);
  await expect.poll(() => askEvents(backendSimulator).at(-1)?.props).toMatchObject({ how: "drag" });
});

test("in the extension panel it is asked in place, and Continue goes on writing", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const capture = await launcher.launchPanel({ ...ASKED, activeVideoUrl: VALID_URL, youTubeFetch: true });
  const ask = launcher.aboutYouAsk;

  await capture.clickCreate();
  await ask.verifyIsShown();
  await ask.verifyWaiting("For this video", "The Simulated Video");
  await ask.clickContinue();

  await ask.verifyIsHidden();
  await expect.poll(() => backendSimulator.ourKey.generations().length).toBe(1);
  await expect.poll(() => flag(backendSimulator)).toBe(true);
});
