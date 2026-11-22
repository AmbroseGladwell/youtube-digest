import { expect, test } from "../../support/fixtures.testHelper.js";
import type { Launcher } from "../../support/Launcher.testHelper.js";
import type { Chat } from "@overview/domain";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import type { PageObject } from "../../pageObjects/PageObject.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { applyReflowCondition, reflowConditions } from "../../support/reflowConditions.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL, firstName: "Ada" },
};

const NOTE = makeOverview({
  inOneLine: "A talking-head explainer about three data points.",
  coreClaim: "The economy may finally be improving.",
  keyPoints: [
    { text: "Growth beat expectations.", range: null },
    { text: "Productivity is moving.", range: null },
    { text: "Hiring intent has turned.", range: null },
  ],
});

const askedEarlier = (question: string, minutesAgo: number): Chat => {
  const at = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  return {
    id: `library:${crypto.randomUUID()}`,
    startedAt: at,
    messages: [
      { from: "reader", text: question, at },
      { from: "answer", text: "An answer.", at, citations: [], inSource: true },
    ],
  };
};

const EARLIER_QUESTIONS = ["What do my overviews agree on?", "Which ideas come up again and again?", "What could I act on this week?"];

interface Screen<Shown extends PageObject = PageObject> {
  name: string;
  open: (launcher: Launcher, backendSimulator: BackendSimulator) => Promise<Shown>;
  verify: (shown: Shown) => Promise<void>;
  brokenUntil?: Record<string, string>;
}

const screen = <Shown extends PageObject>(described: Screen<Shown>): Screen => described as unknown as Screen;

const ZOOMED = reflowConditions[0]!.name;
const SHEET_TOO_SHORT = "OV-385: bottom sheets leave their lists too little room";
const TIME_SAVED_NAME = "OV-389: the time-saved button's name leaves out its visible text";

const openLibrary = (launcher: Launcher, backendSimulator: BackendSimulator) => {
  backendSimulator.overviews.seedSynced(NOTE);
  return launcher.launchExpectingLibrary(SIGNED_IN);
};

const screens: Screen[] = [
  screen({
    name: "the library",
    open: openLibrary,
    verify: (library) => library.verifyReflows(),
    brokenUntil: { axe: TIME_SAVED_NAME },
  }),
  screen({
    name: "the library's filters",
    open: async (launcher, backendSimulator) => {
      const library = await openLibrary(launcher, backendSimulator);
      await library.openFiltersWhereFolded();
      return library;
    },
    verify: (library) => library.verifyFilterControlsCanBeReached(),
    brokenUntil: { [ZOOMED]: SHEET_TOO_SHORT, axe: TIME_SAVED_NAME },
  }),
  screen({
    name: "the account menu",
    open: async (launcher, backendSimulator) => {
      await openLibrary(launcher, backendSimulator);
      return launcher.appShell.accountMenu.open();
    },
    verify: (menu) => menu.verifyItemsCanBeReached(),
    brokenUntil: { [ZOOMED]: "OV-386: the account menu runs off the screen", axe: TIME_SAVED_NAME },
  }),
  screen({
    name: "an overview with its player",
    open: async (launcher, backendSimulator) => {
      backendSimulator.narration.seedReady(NOTE);
      const library = await openLibrary(launcher, backendSimulator);
      return library.nthCard(0).openReader();
    },
    verify: (reader) => reader.verifyReflows(),
  }),
  screen({
    name: "the Ask page",
    open: async (launcher, backendSimulator) => {
      await openLibrary(launcher, backendSimulator);
      return launcher.appShell.openAsk();
    },
    verify: (ask) => ask.verifyReflows(),
  }),
  screen({
    name: "the Ask drawer",
    open: async (launcher, backendSimulator) => {
      EARLIER_QUESTIONS.forEach((question, at) => backendSimulator.chats.seed(askedEarlier(question, at * 90)));
      await openLibrary(launcher, backendSimulator);
      const ask = await launcher.appShell.openAsk();
      await ask.openDrawerWhereFolded();
      return ask;
    },
    verify: (ask) => ask.verifyDrawerControlsCanBeReached(),
    brokenUntil: { [ZOOMED]: SHEET_TOO_SHORT },
  }),
  screen({
    name: "Settings",
    open: async (launcher, backendSimulator) => {
      await openLibrary(launcher, backendSimulator);
      await launcher.openPage(Routes.settings());
      return launcher.settingsPage.verifyIsShown();
    },
    verify: (settings) => settings.verifyReflows(),
  }),
];

const markBroken = (screen: Screen, check: string) => {
  const card = screen.brokenUntil?.[check];
  test.fail(card !== undefined, card);
};

for (const condition of reflowConditions) {
  test.describe(condition.name, () => {
    for (const screen of screens) {
      test(`${screen.name} can still be read and used`, async ({ page, launcher, backendSimulator }) => {
        markBroken(screen, condition.name);
        await applyReflowCondition(page, condition);
        await screen.verify(await screen.open(launcher, backendSimulator));
      });
    }
  });
}

test.describe("the browser's text size", () => {
  for (const screen of screens) {
    test(`${screen.name} grows with it`, async ({ launcher, backendSimulator }) => {
      markBroken(screen, "text");
      const shown = await screen.open(launcher, backendSimulator);
      await shown.verifyTextFollowsTheTextSetting();
    });
  }
});

test.describe("axe", () => {
  for (const screen of screens) {
    test(`finds nothing on ${screen.name}`, async ({ launcher, backendSimulator }) => {
      markBroken(screen, "axe");
      const shown = await screen.open(launcher, backendSimulator);
      await shown.verifyIsAccessible();
    });
  }
});

test("a page that runs off the side fails the reflow check", async ({ page, launcher, backendSimulator }) => {
  const library = await openLibrary(launcher, backendSimulator);
  await page.evaluate(() => document.body.append(Object.assign(document.createElement("div"), { style: "width: 4000px; height: 1px" })));

  await expect(library.verifyReflows()).rejects.toThrow(/scrolls sideways/);
});
