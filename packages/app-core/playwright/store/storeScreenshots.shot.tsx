import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "../support/fixtures.testHelper.js";
import { milestoneCardTestIds } from "../../src/features/timeSaved/components/MilestoneCard/MilestoneCardTestIds.js";
import type { ApiKeys } from "../../src/features/apiKeys/ApiKeys.js";
import { SIMULATED_EMAIL } from "../network/BackendSimulator.testHelper.js";
import { storeLibrary, theDataNote, theSellingNote } from "./storeLibrary.testHelper.js";

// Four of the five screens are captures of a real side panel rather than renders. A render
// here is taken at the harness's viewport, and the panel's layout is driven by media queries
// that read that viewport, so a 420px-wide element inside a 1280px window lays itself out as
// the desktop app and not as the panel anyone installs
// (docs/architecture/store-listing.md, "The screenshots").
const SOURCES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../apps/extension/store/sources");

const SHOTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../apps/extension/store/screenshots");

// Every shot is the side panel, because the side panel is the extension. Its other surface,
// app.html, is an options_ui page nothing in the product links to, so the one shot that is
// not the panel is the library the account syncs to, and its caption says so
// (docs/architecture/store-listing.md, "The screenshots").

// Captures are placed by height, not width, so the panel is the same size in every one of
// them and the listing does not jump as it is scrolled through. The four sources were taken
// at slightly different panel widths, so their placed widths differ by about three pixels;
// the right edge is the fixed one, which puts that difference against the abstracted page
// where nothing lines up with it anyway.
const CAPTURE_HEIGHT = 700;

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

// The keys screen shows the last four characters of the stored key, and the shared seed's
// end in "test", which reads as a fixture on a store page rather than as someone's key.
const ANTHROPIC_KEY: ApiKeys = {
  keys: { anthropic: { key: "sk-ant-api03-7f2c9e41b6d8", addedAt: "2026-09-12T09:00:00.000Z" } },
};

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://theoverviewapp.com", token: "session-token", email: SIMULATED_EMAIL, firstName: "Ada" },
};

const dressed = async (page: Page): Promise<void> => {
  await page.addStyleTag({ url: FONTS });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "* { caret-color: transparent !important; }" });
  await expect.poll(() => page.evaluate(() => [...document.images].every((image) => image.complete))).toBe(true);
};

// What fills the window to the left of the panel. "wide" is the one shot that is not the
// panel at all, and fills the window with the web app instead.
type Surface = "page" | "chat" | "wide";

interface Caption {
  lead: string;
  accent: string;
  sub: string;
  // Headlines wrap on their own, which can start the accent mid-line or strand its last word.
  // Setting this breaks the line at the split, so the two halves get a line each.
  breakAtSplit?: boolean;
}

interface Composition {
  surface?: Surface;
  // The width to place a capture at, which panelFrom works out from the image. Null renders
  // the live #root at the panel's own width instead.
  captureWidth?: number | null;
  // The two notes the chat surface's reply names, passed in so they come from the library
  // rather than being written out here.
  cites?: readonly [string, string];
}

// The panel is a fifth of the store's 1280 frame, so the rest of the image is a caption and
// the browser the panel is docked in. The panel's own pixels are untouched: nothing is
// scaled unevenly, recoloured or drawn over, and the window behind it is deliberately an
// abstraction, a title bar and soft grey blocks, carrying no site's name, mark or layout
// (docs/architecture/store-listing.md, "The screenshots").
const composed = (
  page: Page,
  { lead, accent, sub, breakAtSplit = false }: Caption,
  { surface = "page", captureWidth = null, cites = ["", ""] }: Composition = {},
): Promise<void> =>
  page.evaluate(
    ([placed, tall, ground, grid, ink, muted, accentInk, chrome, mark, leadText, accentText, subText, which, splitLine, named]) => {
      // A capture of a real panel, placed in the window the way a live panel is.
      const captured = placed !== null;
      // The width Chrome opens the side panel at, for a live render. Every capture brings
      // its own, worked out from the image.
      const PANEL = Number(placed ?? 420);
      const HEIGHT = Number(tall);
      const chatting = which === "chat";
      const docked = which !== "wide";
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
      // One geometry for every shot, so the frame does not move as the listing is scrolled.
      const INSET = 16;
      const BAR = 38;
      const frame = add(document.body, "div", {
        position: "absolute",
        top: `${INSET}px`,
        left: chatting ? "470px" : "578px",
        right: "30px",
        bottom: `${INSET}px`,
        borderRadius: "16px",
        background: "#f3f0ea",
        boxShadow: "0 40px 90px rgba(21, 22, 24, 0.18), 0 2px 6px rgba(21, 22, 24, 0.06)",
        overflow: "hidden",
      });
      const bar = add(frame, "div", {
        display: "flex",
        height: `${BAR}px`,
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
        top: `${BAR}px`,
        left: "0",
        right: `${PANEL}px`,
        bottom: "0",
        padding: "26px 24px",
        flexDirection: "column",
        gap: "14px",
        // The blocks are a page that carries on past the window, so they fade out. A
        // conversation does not: it is the whole of what it is, and a faded last line reads
        // as a rendering fault.
        maskImage: chatting ? "none" : "linear-gradient(to bottom, #000 45%, transparent 92%)",
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
        const [measured, built] = named as readonly [string, string];
        bubble("What have I saved about how AI is changing software?", true);
        bubble(
          `Two overviews. <strong>${measured}</strong> measures the shift with the author's own data, and <strong>${built}</strong> is the practical build.`,
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
      // A capture is set the same distance off the window's top and bottom edges, so it sits
      // in the frame rather than filling it.
      const inner = frame.clientHeight - BAR;
      const root = document.getElementById("root");
      if (root !== null) {
        at(
          root,
          docked
            ? {
                position: "absolute",
                top: captured ? `${BAR + Math.round((inner - HEIGHT) / 2)}px` : `${BAR}px`,
                right: "0",
                bottom: captured ? "auto" : "0",
                height: captured ? `${HEIGHT}px` : "",
                width: `${PANEL}px`,
                overflow: "hidden",
                // A capture is a rectangle of pixels, and a hard corner against the window's
                // own soft one reads as pasted on. A small radius sets it into the frame.
                borderRadius: captured ? "12px" : "0",
                boxShadow: "-18px 0 40px rgba(21, 22, 24, 0.10)",
              }
            : {
                position: "absolute",
                top: `${BAR}px`,
                left: "0",
                bottom: "0",
                width: "1180px",
                overflow: "hidden",
              },
        );
        frame.append(root);
      }
    },
    [
      captureWidth,
      CAPTURE_HEIGHT,
      GROUND,
      GRID,
      INK,
      MUTED,
      ACCENT,
      CHROME,
      MARK,
      lead,
      accent,
      sub,
      surface,
      breakAtSplit,
      cites,
    ] as const,
  );

// A capture taken by hand catches a line or two of the dimmed browser behind the panel on
// one or two of its edges, which reads as a dark hairline once the capture is set into the
// window. Whole rows and columns of it are trimmed off, so the sources stay exactly what came
// off the machine and the next capture needs no cropping either.
const EDGE_TRIM_LIMIT = 8;

// The browser behind the panel dims to about rgb(53,53,53). The panel's own ink is near
// rgb(21,22,24), so a band this tight around the chrome grey cannot catch text.
const CHROME_GREY = { lowest: 35, highest: 75, spread: 6 } as const;

// The panel's own pixels, from a real install, put where the live panel would be. Returns the
// width the shared height gives it, which composed() then docks it at.
const panelFrom = async (page: Page, file: string): Promise<number> => {
  const source = `data:image/png;base64,${readFileSync(path.join(SOURCES, file)).toString("base64")}`;
  const aspect = await page.evaluate(
    async ([data, limit, grey]) => {
      const shot = new Image();
      shot.src = String(data);
      await shot.decode();
      const whole = document.createElement("canvas");
      whole.width = shot.naturalWidth;
      whole.height = shot.naturalHeight;
      const drawing = whole.getContext("2d", { willReadFrequently: true });
      if (drawing === null) throw new Error("no 2d context");
      drawing.drawImage(shot, 0, 0);
      const { data: pixels, width, height } = drawing.getImageData(0, 0, whole.width, whole.height);

      const band = grey as { lowest: number; highest: number; spread: number };
      const dimmed = (x: number, y: number): boolean => {
        const i = (y * width + x) * 4;
        const r = pixels[i] ?? 0;
        const g = pixels[i + 1] ?? 0;
        const b = pixels[i + 2] ?? 0;
        const flat = Math.abs(r - g) < band.spread && Math.abs(g - b) < band.spread;
        return flat && r > band.lowest && r < band.highest;
      };
      // One stray pixel should not keep an edge, and one lit pixel should not lose a row.
      const nearlyAll = (count: number, of: number): boolean => count >= of * 0.98;
      const dimmedRow = (y: number): boolean => {
        let n = 0;
        for (let x = 0; x < width; x += 1) if (dimmed(x, y)) n += 1;
        return nearlyAll(n, width);
      };
      const dimmedColumn = (x: number): boolean => {
        let n = 0;
        for (let y = 0; y < height; y += 1) if (dimmed(x, y)) n += 1;
        return nearlyAll(n, height);
      };

      const most = Number(limit);
      let top = 0;
      while (top < most && dimmedRow(top)) top += 1;
      let bottom = 0;
      while (bottom < most && dimmedRow(height - 1 - bottom)) bottom += 1;
      let left = 0;
      while (left < most && dimmedColumn(left)) left += 1;
      let right = 0;
      while (right < most && dimmedColumn(width - 1 - right)) right += 1;

      const panel = document.createElement("canvas");
      panel.width = width - left - right;
      panel.height = height - top - bottom;
      const onto = panel.getContext("2d");
      if (onto === null) throw new Error("no 2d context");
      onto.drawImage(whole, left, top, panel.width, panel.height, 0, 0, panel.width, panel.height);
      Object.assign(panel.style, { width: "100%", height: "100%", display: "block" });

      const root = document.getElementById("root");
      root?.replaceChildren(panel);
      return panel.width / panel.height;
    },
    [source, EDGE_TRIM_LIMIT, CHROME_GREY] as const,
  );
  return Math.round(aspect * CAPTURE_HEIGHT);
};

const shoot = (page: Page, name: string): Promise<Buffer> =>
  page.screenshot({ path: path.join(SHOTS, `${name}.png`), animations: "disabled" });

// The captions sell what the reader gets, not what the software has, and they say it the
// positive way round: what an hour of your evening buys, never what your saved list is full
// of (docs/architecture/store-listing.md, "The words").

test("a note, which is what saving something gets you", async ({ launcher }) => {
  const capture = await launcher.launchPanel({ apiKeys: ANTHROPIC_KEY });
  const width = await panelFrom(capture.page, "note-panel.png");
  await dressed(capture.page);
  await composed(
    capture.page,
    {
      lead: "All the info,",
      accent: "less wait.",
      breakAtSplit: true,
      sub: "Videos, articles and recipes become a short overview: the premise, the core claim, the key points and what to do next.",
    },
    { captureWidth: width },
  );

  await shoot(capture.page, "1-note");
});

// Following a playlist is the one thing that works at more than one video at a time, so it
// gets the slot chapters had.
test("a pasted playlist, previewed before it runs", async ({ launcher }) => {
  const capture = await launcher.launchPanel({ apiKeys: ANTHROPIC_KEY });
  const width = await panelFrom(capture.page, "playlist-panel.png");
  await dressed(capture.page);
  await composed(
    capture.page,
    {
      lead: "Point it at",
      accent: "a whole playlist.",
      sub: "Paste a playlist link, then convert what's there or follow it so new videos become overviews as they're added.",
      breakAtSplit: true,
    },
    { captureWidth: width },
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
    { surface: "wide" },
  );

  await shoot(shelf.page, "3-time-saved");
});

// The connection itself, in the panel, with the conversation it makes possible beside it. The
// panel is the product's own screen; the bubbles are an illustration of the assistant's side,
// drawn in onboarding's own bubble styling and citing notes that really are in the house
// account's samples (docs/architecture/store-listing.md, "The screenshots").
test("the connection, and the conversation it allows", async ({ launcher }) => {
  const capture = await launcher.launchPanel({ apiKeys: ANTHROPIC_KEY });
  const width = await panelFrom(capture.page, "assistant-panel.png");
  await dressed(capture.page);
  await composed(
    capture.page,
    {
      lead: "Your whole library,",
      accent: "one question away.",
      sub: "Connect your AI assistant and it can pull together everything you’ve saved on a topic, turning your library into context it can work from.",
    },
    {
      surface: "chat",
      captureWidth: width,
      cites: [theDataNote().source.title, theSellingNote().source.title],
    },
  );

  await shoot(capture.page, "4-assistant");
});

test("cooking from a recipe, one step at a time", async ({ launcher }) => {
  const capture = await launcher.launchPanel({ apiKeys: ANTHROPIC_KEY });
  const width = await panelFrom(capture.page, "cooking-panel.png");
  await dressed(capture.page);
  await composed(
    capture.page,
    {
      lead: "Cook without",
      accent: "the scrolling.",
      sub: "Recipes you save now get a cooking mode, one step at a time: read aloud, with ingredients a tap away. Servings scaled, and units converted for you.",
      breakAtSplit: true,
    },
    { captureWidth: width },
  );

  await shoot(capture.page, "5-cooking");
});
