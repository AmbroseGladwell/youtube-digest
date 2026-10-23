import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

// Which key an overview is made on, and what the reader is told (docs/architecture/tiers.md,
// "Which key an overview uses").
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
  apiKeys: ANTHROPIC_KEY,
};
const { apiKeys: _noKey, ...SIGNED_IN_WITHOUT_A_KEY } = SIGNED_IN;
const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;

test("a Free reader whose Anthropic key is out of credit gets the overview on our key, and the reader says so", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.anthropicIsOutOfCredit();
  await launcher.launch(SIGNED_IN);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyMadeOnLine("Made on our key: your Anthropic key was out of credit");
  expect(backendSimulator.ourKey.generations()).toHaveLength(1);
  expect(backendSimulator.ourKey.reservations()).toHaveLength(1);
  expect(backendSimulator.ourKey.releases()).toHaveLength(1);
});

test("an overview the reader's own key makes reserves its slot first, and says nothing about keys", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(SIGNED_IN);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyMadeOnLine(null);
  const [overview] = await backendSimulator.overviewStore.listOverviews();
  expect(backendSimulator.ourKey.reservations()).toEqual([{ overviewId: overview!.id }]);
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
});

test("on Plus our key goes first, so the reader's own key is never asked", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch({ ...SIGNED_IN, plan: "plus" });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyMadeOnLine(null);
  expect(backendSimulator.ourKey.generations()).toHaveLength(1);
  expect(backendSimulator.ourKey.reservations()).toHaveLength(0);
});

test("with Only ever use my key on, an out-of-credit key fails rather than going to our key", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.anthropicIsOutOfCredit();
  await launcher.launch({ ...SIGNED_IN, onlyMyKey: true });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);

  await dialog.form.verifyGenerationErrorIsVisible();
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
});

test("past the own-key month a Free reader's overview is made on our key, and says why", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.ownMonthIsSpent();
  await launcher.launch(SIGNED_IN);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyMadeOnLine("Made on our key: you’d made this month’s overviews on your own key");
});

test("a signed-in reader with no key of their own makes overviews on our key", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyMadeOnLine(null);
  expect(backendSimulator.ourKey.generations()).toHaveLength(1);
});

test("Settings puts Only ever use my key beside the keys, saying where a fallback sends the transcript", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(SIGNED_IN);
  const keys = (await (await launcher.appShell.openSettings()).openSection("keys")).apiKeysPanel;

  await keys.verifyOnlyMyKey(false);
  await keys.verifyOnlyMyKeyExplains(/sends the transcript and your reader context to OpenAI through our server/);

  await keys.toggleOnlyMyKey();

  await keys.verifyOnlyMyKey(true);
  await keys.verifyOnlyMyKeyExplains(/nothing is sent to OpenAI/);
});

test("where our key can't be used, there is no fallback to switch off", async ({ launcher }) => {
  await launcher.launch(SIGNED_IN);
  const keys = (await (await launcher.appShell.openSettings()).openSection("keys")).apiKeysPanel;

  await keys.verifyOnlyMyKey("absent");
});
