import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "../support/fixtures.testHelper.js";
import { Routes } from "../../src/app/Routes.js";
import { readerPlayerBarTestIds } from "../../src/features/reader/components/ReaderPlayerBar/ReaderPlayerBarTestIds.js";
import { cookingModeTestIds } from "../../src/features/reader/components/CookingMode/CookingModeTestIds.js";
import { milestoneCardTestIds } from "../../src/features/timeSaved/components/MilestoneCard/MilestoneCardTestIds.js";
import { ReaderPageObject } from "../pageObjects/ReaderPageObject.testHelper.js";
import { capturePageTestIds } from "../../src/features/capture/CapturePage/CapturePageTestIds.js";
import { readerPageTestIds } from "../../src/features/reader/ReaderPage/ReaderPageTestIds.js";
import type { CapturePageObject } from "../pageObjects/CapturePageObject.testHelper.js";
import type { ApiKeys } from "../../src/features/apiKeys/ApiKeys.js";
import { SIMULATED_EMAIL } from "../network/BackendSimulator.testHelper.js";
import { storeLibrary, theNote, theRecipe } from "./storeLibrary.testHelper.js";

// Two screens are captures of a real side panel rather than renders. Cooking mode needs a
// taller panel than this canvas and its narration state ("Waiting for you") cannot be reached
// without the TTS pool; the playlist preview is a real 204-video playlist, which no fixture
// would be (docs/architecture/store-listing.md, "The screenshots").
const SOURCES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../apps/extension/store/sources",
);

const SHOTS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../apps/extension/store/screenshots",
);

// Every shot is the side panel, because the side panel is the extension. Its other surface,
// app.html, is an options_ui page nothing in the product links to, so a listing that showed
// the wide layout would be selling a screen almost nobody opens
// (docs/architecture/store-listing.md, "The screenshots").
const PANEL_WIDTH = 420;

// The two families tokens.scss names. The app's own @font-face rules ship in the extension's
// public/fonts.css, which this harness never loads, so a shot taken without this would be the
// fallback stack rather than the product.
const FONTS = "https://fonts.googleapis.com/css2?family=Gloock&family=Figtree:wght@400;500;600;700&display=swap";

// tokens.scss's own light palette, so the image around the panel is the product's own and
// not a second one invented for the store.
const GROUND = "#ece8e1";
const GRID = "rgba(21, 22, 24, 0.035)";
const INK = "#151618";
const MUTED = "#5f5c57";
const ACCENT = "#b03c12";
const CHROME = "#dcd7ce";
const MARK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="34" height="34">' +
  '<circle cx="16" cy="14.5" r="7.5" fill="none" stroke="#E2511E" stroke-width="3"></circle>' +
  '<rect x="7" y="25" width="18" height="2.5" fill="#E2511E"></rect></svg>';

// Narration is rendered by the TTS pool, which this harness cannot reach, so the bar reads
// "Read-along · no audio", true here and false in a real install. Showing a bar that says
// the product has no sound would be the misleading option.
const noNarrationSaid = [readerPlayerBarTestIds.root, cookingModeTestIds.voice]
  .map((id) => `[data-testid="${id}"]`)
  .join(", ")
  .concat(" { display: none !important; }");

// The keys screen shows the last four characters of the stored key, and the shared seed's
// end in "test", which reads as a fixture on a store page rather than as someone's key.
const ANTHROPIC_KEY: ApiKeys = {
  keys: { anthropic: { key: "sk-ant-api03-7f2c9e41b6d8", addedAt: "2026-09-12T09:00:00.000Z" } },
};

const recipeMethodCook = "RecipeMethod.cook";

// A takeover screen covers the whole side panel in Chrome, where it is positioned against the
// panel's own viewport. In these shots #root is a positioned, clipped box, so it becomes the
// takeover's containing block and the reader's sticky head paints over it. This puts the real
// order back; it changes no pixel of the screen itself.
const TAKEOVER_ABOVE_THE_HEAD = "dialog[open] { z-index: 50 !important; }";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://theoverviewapp.com", token: "session-token", email: SIMULATED_EMAIL, firstName: "Ada" },
};

const dressed = async (page: Page): Promise<void> => {
  await page.addStyleTag({ url: FONTS });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: `* { caret-color: transparent !important; }\n${noNarrationSaid}` });
  await expect
    .poll(() => page.evaluate(() => [...document.images].every((image) => image.complete)))
    .toBe(true);
};

type Surface = "panel" | "wide" | "chat" | "dialog" | "capture";

interface Caption {
  lead: string;
  accent: string;
  sub: string;
  // Headlines wrap on their own, which can start the accent mid-line or strand its last word.
  // Setting this breaks the line at the split, so the two halves get a line each.
  breakAtSplit?: boolean;
}

// The panel is 420px and the store's frame is 1280, so the rest of the image is a caption and
// the browser the panel is docked in. The panel's own pixels are untouched: nothing is
// scaled, recoloured or drawn over, and the window behind it is deliberately an abstraction,
// a title bar and soft grey blocks, carrying no site's name, mark or layout
// (docs/architecture/store-listing.md, "The screenshots").
const composed = (
  page: Page,
  { lead, accent, sub, breakAtSplit = false }: Caption,
  surface: Surface = "panel",
): Promise<void> =>
  page.evaluate(
    ([width, ground, grid, ink, muted, accentInk, chrome, mark, leadText, accentText, subText, which, splitLine]) => {
      const PANEL = Number(width);
      const chatting = which === "chat";
      const centred = which === "dialog";
      // A capture of a real panel, placed in the window the way a live panel is.
      const captured = which === "capture";
      const docked = which === "panel" || chatting || captured;
      document.documentElement.style.background = String(ground);
      Object.assign(document.body.style, {
        margin: "0",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        background: `
          linear-gradient(${grid} 1px, transparent 1px) 0 0 / 64px 64px,
          linear-gradient(90deg, ${grid} 1px, transparent 1px) 0 0 / 64px 64px,
          radial-gradient(120% 90% at 18% 20%, #f6f4f0 0%, ${ground} 62%)`,
      });

      const at = (element: HTMLElement, style: Partial<CSSStyleDeclaration>) => Object.assign(element.style, style);
      const add = (parent: HTMLElement, tag: string, style: Partial<CSSStyleDeclaration>) => {
        const element = document.createElement(tag);
        at(element as HTMLElement, style);
        parent.append(element);
        return element as HTMLElement;
      };

      // The window the panel is docked in: a title bar, an address pill with no text, and
      // blocks standing in for a page. Nothing here names or resembles a particular site.
      const frame = add(document.body, "div", {
        position: "absolute",
        // One window geometry for every shot, so the frame does not jump as the listing is
        // scrolled through. Its height is the one the real captures come at.
        top: "16px",
        left: chatting ? "470px" : "578px",
        right: "30px",
        bottom: "16px",
        borderRadius: "16px",
        background: "#f3f0ea",
        boxShadow: "0 40px 90px rgba(21, 22, 24, 0.18), 0 2px 6px rgba(21, 22, 24, 0.06)",
        overflow: "hidden",
      });
      const bar = add(frame, "div", {
        display: "flex",
        height: "38px",
        background: String(chrome),
        alignItems: "center",
        gap: "7px",
        padding: "0 14px",
      });
      for (const _ of [0, 1, 2]) {
        add(bar, "span", {
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: "rgba(21, 22, 24, 0.17)",
        });
      }
      add(bar, "span", {
        flex: "1",
        height: "18px",
        marginLeft: "10px",
        marginRight: "40%",
        borderRadius: "9px",
        background: "rgba(255, 255, 255, 0.6)",
      });

      const page_ = add(frame, "div", {
        display: docked ? "flex" : "none",
        position: "absolute",
        top: "38px",
        left: "0",
        right: `${PANEL}px`,
        bottom: "0",
        padding: "26px 24px",
        flexDirection: "column",
        gap: "14px",
        maskImage: "linear-gradient(to bottom, #000 45%, transparent 92%)",
      });
      if (chatting) {
        at(page_, { justifyContent: "center", gap: "10px", padding: "26px 22px" });
        const bubble = (html: string, mine: boolean) => {
          const node = add(page_, "div", {
            maxWidth: "88%",
            padding: "10px 14px",
            fontSize: "14px",
            lineHeight: "1.45",
            alignSelf: mine ? "flex-end" : "flex-start",
            borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            background: mine ? "#3a3835" : "#ffffff",
            color: mine ? "#f6f4f0" : "#151618",
          });
          node.innerHTML = html;
        };
        bubble("What have I saved about how AI is changing software?", true);
        bubble(
          "Two overviews. <strong>How software engineering is changing</strong> measures the shift with the author's own data, and <strong>Turn Claude Code Into Your AI Operating System</strong> is the practical build.",
          false,
        );
        bubble("Which one should I act on first?", true);
      } else {
        add(page_, "div", { height: "118px", borderRadius: "10px", background: "rgba(21, 22, 24, 0.10)" });
        for (const width_ of ["92%", "100%", "78%", "96%", "64%"]) {
          add(page_, "div", {
            height: "11px",
            width: width_,
            borderRadius: "6px",
            background: "rgba(21, 22, 24, 0.07)",
          });
        }
      }

      const aside = add(document.body, "aside", {
        position: "absolute",
        left: "64px",
        top: "0",
        bottom: "0",
        width: chatting ? "368px" : "470px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "20px",
        color: String(ink),
        fontFamily: '"Figtree", system-ui, sans-serif',
      });

      const heading = add(aside, "h2", {
        margin: "0",
        fontFamily: '"Gloock", Georgia, serif',
        fontSize: chatting ? "42px" : "54px",
        lineHeight: "1.06",
        fontWeight: "400",
        letterSpacing: "-0.01em",
      });
      heading.append(document.createTextNode(String(leadText)));
      heading.append(splitLine === true ? document.createElement("br") : document.createTextNode(" "));
      const emphasis = document.createElement("span");
      emphasis.style.color = String(accentInk);
      emphasis.textContent = String(accentText);
      heading.append(emphasis);

      const paragraph = add(aside, "p", {
        margin: "0",
        fontSize: "20px",
        lineHeight: "1.55",
        color: String(muted),
        maxWidth: "36ch",
      });
      paragraph.textContent = String(subText);

      const logo = add(document.body, "div", {
        position: "absolute",
        left: "76px",
        bottom: "54px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        fontFamily: '"Gloock", Georgia, serif',
        fontSize: "21px",
        color: String(ink),
      });
      logo.innerHTML = String(mark);
      const name = document.createElement("span");
      name.textContent = "The Overview";
      logo.append(name);

      // The panel itself, docked at the window's right edge, at the width Chrome gives it.
      const root = document.getElementById("root");
      if (root !== null) {
        at(
          root,
          docked
            ? {
                position: "absolute",
                top: captured ? "47px" : "38px",
                right: "0",
                bottom: captured ? "auto" : "0",
                // A capture sizes itself from the image inside it.
                height: captured ? "auto" : "",
                width: `${PANEL}px`,
                overflow: "hidden",
                // A capture is a rectangle of pixels, and a hard corner against the window's
                // own soft one reads as pasted on. A small radius sets it into the frame.
                borderRadius: captured ? "12px" : "0",
                boxShadow: "-18px 0 40px rgba(21, 22, 24, 0.10)",
              }
            : {
                position: "absolute",
                top: "38px",
                left: "0",
                bottom: "0",
                right: centred ? "0" : "",
                width: centred ? "" : "1180px",
                overflow: "hidden",
              },
        );
        frame.append(root);
      }
    },
    [PANEL_WIDTH, GROUND, GRID, INK, MUTED, ACCENT, CHROME, MARK, lead, accent, sub, surface, breakAtSplit] as const,
  );

// After composition, because composing moves #root into the window frame and puts its
// scroller back to the top.
const scrolledTo = async (page: Page, heading: string): Promise<void> => {
  const section = page.getByText(heading, { exact: true });
  await expect(section).toBeVisible();
  await section.evaluate((element) => {
    element.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await expect(section).toBeInViewport();
};

// A rectangle of the capture to soften, as fractions of the image, for a line that names
// somebody. Public does not mean theirs to advertise with
// (docs/architecture/store-listing.md, "The screenshots").
interface Softened {
  left: number;
  top: number;
  width: number;
  height: number;
}

// The panel's own pixels, from a real install, put where the live panel would be.
const panelFrom = (page: Page, file: string, soften: Softened | null = null): Promise<void> =>
  page.evaluate(
    ([source, region]) => {
      const root = document.getElementById("root");
      if (root === null) return;
      root.replaceChildren();
      const frame = document.createElement("div");
      frame.style.position = "relative";
      const shot = document.createElement("img");
      shot.src = String(source);
      shot.style.width = "100%";
      shot.style.display = "block";
      frame.append(shot);
      if (region !== null) {
        const patch = document.createElement("div");
        const box = region as Softened;
        Object.assign(patch.style, {
          position: "absolute",
          left: `${box.left * 100}%`,
          top: `${box.top * 100}%`,
          width: `${box.width * 100}%`,
          height: `${box.height * 100}%`,
          background: "#f6f4f0",
        });
        frame.append(patch);
      }
      root.append(frame);
    },
    [`data:image/png;base64,${readFileSync(path.join(SOURCES, file)).toString("base64")}`, soften] as const,
  );

const shoot = (page: Page, name: string): Promise<Buffer> =>
  page.screenshot({ path: path.join(SHOTS, `${name}.png`), animations: "disabled" });

// The route change cross-fades, and the screen being left is still painted while it does, so
// a shot taken too early catches the capture screen behind the note.
const onlyOneScreen = (page: Page): Promise<void> =>
  expect(
    page.getByTestId(capturePageTestIds.root).or(page.getByTestId(readerPageTestIds.root)),
  ).toHaveCount(1);

const readerOn = async (
  launcher: { openPage: (path: string) => Promise<void> },
  capture: CapturePageObject,
  overviewId: string,
): Promise<ReaderPageObject> => {
  await launcher.openPage(Routes.overview(overviewId));
  const reader = await new ReaderPageObject(capture.testContext).verifyIsShown();
  await onlyOneScreen(capture.page);
  return reader;
};

// The captions sell what the reader gets, not what the software has, and they say it the
// positive way round: what an hour of your evening buys, never what your saved list is full
// of (docs/architecture/store-listing.md, "The words").

test("a note, which is what saving something gets you", async ({ launcher, backendSimulator }) => {
  storeLibrary(backendSimulator);
  const capture = await launcher.launchPanel({ apiKeys: ANTHROPIC_KEY, showMilestoneCards: false });
  await readerOn(launcher, capture, theNote().id);
  await dressed(capture.page);
  await composed(capture.page, {
    lead: "All the info,",
    accent: "less wait.",
    breakAtSplit: true,
    sub: "Videos, articles and recipes become a short overview: the premise, the core claim, the key points and what to do next.",
  });

  await shoot(capture.page, "1-note");
});

// Following a playlist is the one thing that works at more than one video at a time, so it
// gets the slot chapters had. It is a capture of a real 204-video playlist: the numbers are
// the point, and no fixture would carry them honestly.
test("a pasted playlist, previewed before it runs", async ({ launcher }) => {
  const capture = await launcher.launchPanel({ apiKeys: ANTHROPIC_KEY });
  await dressed(capture.page);
  await panelFrom(capture.page, "playlist-panel.png", { left: 0.03, top: 0.293, width: 0.40, height: 0.032 });
  await composed(
    capture.page,
    {
      lead: "Point it at",
      accent: "a whole playlist.",
      sub: "Paste a playlist link, then convert what's there or follow it so new videos become overviews as they're added.",
      breakAtSplit: true,
    },
    "capture",
  );

  await shoot(capture.page, "2-playlist");
});

// The library, and so the running total, is the web app's: the panel is one video by design
// (docs/features/extension-panel.md), so this one shot is the wider surface the account syncs
// to, and its caption says so.
test("the hours the habit gives back", async ({ launcher, backendSimulator }) => {
  storeLibrary(backendSimulator);
  // The milestone card is the point of this shot, and a crossing is recorded against the
  // account, so this one is signed in (docs/features/time-saved.md, "Milestones").
  const shelf = await launcher.launchExpectingLibrary(SIGNED_IN);
  await dressed(shelf.page);
  // 1h crosses two milestones, and the smaller is on top. The card behind it is the one worth
  // showing, so the first is dismissed the way a reader would dismiss it.
  const card = shelf.page.getByTestId(milestoneCardTestIds.root).first();
  await shelf.page.getByTestId(milestoneCardTestIds.dismissButton).first().click();
  await expect(card.getByTestId(milestoneCardTestIds.pill)).toHaveText(/1 hour/);
  // Five lines cycle: three jokes, then two facts (milestoneLines.ts). A store page is not the
  // place for the sellotape one, so the card is moved to the first of the facts.
  await card.getByTestId(milestoneCardTestIds.dot(3)).click();
  // The total rolls up to its value, so it is waited out rather than caught part-way.
  await expect(card.getByTestId(milestoneCardTestIds.figure)).toHaveText(/^1h\s*00m$/);
  await composed(
    shelf.page,
    {
      lead: "Get your",
      accent: "evenings back.",
      sub: "Every overview you read instead of watching is counted, so you can see the hours saved add up. Sign in and the same library opens in the web app, on any device.",
    },
    "wide",
  );

  await shoot(shelf.page, "3-time-saved");
});

// The connection itself, in the panel, with the conversation it makes possible beside it. The
// panel is the product's own screen; the bubbles are an illustration of the assistant's side,
// drawn in onboarding's own bubble styling and citing notes that really are in the library
// these shots are taken from (docs/architecture/store-listing.md, "The screenshots").
test("the connection, and the conversation it allows", async ({ launcher, backendSimulator }) => {
  backendSimulator.connections.seed({
    id: "claude",
    clientName: "Claude",
    createdAt: "2026-09-12T12:00:00.000Z",
    lastUsedAt: new Date("2026-11-05T18:30:00.000Z").toISOString(),
  });
  const capture = await launcher.launchPanel({ apiKeys: ANTHROPIC_KEY, ...SIGNED_IN });
  await launcher.openPage(Routes.settingsSection("connections"));
  await dressed(capture.page);
  await composed(
    capture.page,
    {
      lead: "Your whole library,",
      accent: "one question away.",
      sub: "Connect your AI assistant and it can pull together everything you’ve saved on a topic, turning your library into context it can work from.",
    },
    "chat",
  );

  await shoot(capture.page, "4-assistant");
});

test("cooking from a recipe, one step at a time", async ({ launcher }) => {
  const capture = await launcher.launchPanel({ apiKeys: ANTHROPIC_KEY });
  await dressed(capture.page);
  await panelFrom(capture.page, "cooking-panel.png");
  await composed(
    capture.page,
    {
      lead: "Cook without",
      accent: "the scrolling.",
      sub: "Recipes you save now get a cooking mode, one step at a time: read aloud, with ingredients a tap away. Servings scaled, and units converted for you.",
      breakAtSplit: true,
    },
    "capture",
  );

  await shoot(capture.page, "5-cooking");
});
