import type { Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Connection } from "@overview/domain";
import { expect, test } from "../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../network/BackendSimulator.testHelper.js";
import { recentOverviewsTestIds } from "../../src/features/capture/components/RecentOverviews/RecentOverviewsTestIds.js";
import {
  STORE_ANSWER_READ,
  STORE_QUESTION,
  oneOfEachKind,
  storeAnswer,
  storeLibrary,
  theBigPictureVideoUrl,
  theDataNote,
  theRecipe,
  theSellingNote,
} from "./storeLibrary.testHelper.js";

const SHOTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../apps/extension/store/screenshots");

// The larger of the two sizes the Web Store accepts.
const STORE = { width: 1280, height: 800 };

// The width Chrome opens the side panel at, and a laptop's height for it.
const PANEL = { width: 392, height: 780 };

// The window every shot is set in: docs/architecture/store-listing.md, "The screenshots".
const INSET = 16;
const BAR = 38;
const WINDOW_RIGHT = 30;
const WINDOW_LEFT = 578;
const CHAT_WINDOW_LEFT = 470;

// The web app is rendered at the window's own inside, so it is placed one to one.
const WIDE = { width: STORE.width - WINDOW_LEFT - WINDOW_RIGHT, height: STORE.height - 2 * INSET - BAR };

// Panels are placed by height, so all three come out the same size.
const PANEL_HEIGHT = 700;

// The app's @font-face rules ship in public/fonts.css, which this harness never loads.
const FONTS = "https://fonts.googleapis.com/css2?family=Gloock&family=Figtree:wght@400;500;600;700&display=swap";

// tokens.scss's own light palette.
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

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://theoverviewapp.com", token: "session-token", email: SIMULATED_EMAIL, firstName: "Ada" },
};

const CLAUDE: Connection = {
  id: "claude",
  clientName: "Claude",
  createdAt: "2026-11-01T12:00:00.000Z",
  lastUsedAt: "2026-11-24T12:00:00.000Z",
  readsProfile: true,
  writes: true,
};

const dressed = async (page: Page): Promise<void> => {
  await page.addStyleTag({ url: FONTS });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "* { caret-color: transparent !important; }" });
  await expect.poll(() => page.evaluate(() => [...document.images].every((image) => image.complete))).toBe(true);
};

// A click leaves focus and hover behind, which a reader at rest would not see.
const atRest = async (page: Page): Promise<void> => {
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
};

// The app laid out at the size it is shown at: docs/architecture/store-listing.md, "Rendered at its own size".
const rendered = async (page: Page, size: { width: number; height: number }, reach: () => Promise<void>): Promise<string> => {
  await page.setViewportSize(size);
  await reach();
  await dressed(page);
  await atRest(page);
  const shot = await page.screenshot({ animations: "disabled" });
  await page.setViewportSize(STORE);
  return `data:image/png;base64,${shot.toString("base64")}`;
};

// "wide" fills the window with the web app; "chat" leaves room beside the panel for a conversation.
type Surface = "panel" | "chat" | "wide";

interface Caption {
  lead: string;
  accent: string;
  sub: string;
  breakAtSplit?: boolean;
}

interface Composition {
  surface?: Surface;
  cites?: readonly [string, string];
}

// The window behind is deliberately abstract: docs/architecture/store-listing.md, "The screenshots".
const composed = (
  page: Page,
  image: string,
  { lead, accent, sub, breakAtSplit = false }: Caption,
  { surface = "panel", cites = ["", ""] }: Composition = {},
): Promise<void> =>
  page.evaluate(
    async ([
      source,
      tall,
      inset,
      barHeight,
      windowLeft,
      chatWindowLeft,
      windowRight,
      ground,
      grid,
      ink,
      muted,
      accentInk,
      chrome,
      mark,
      leadText,
      accentText,
      subText,
      which,
      splitLine,
      named,
    ]) => {
      const chatting = which === "chat";
      const docked = which !== "wide";
      const INSET = Number(inset);
      const BAR = Number(barHeight);
      const app = document.getElementById("root");
      if (app !== null) {
        app.style.display = "none";
      }
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

      const frame = add(document.body, "div", {
        position: "absolute",
        top: `${INSET}px`,
        left: `${chatting ? chatWindowLeft : windowLeft}px`,
        right: `${windowRight}px`,
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

      const shot = new Image();
      shot.src = String(source);
      await shot.decode();
      const placedWidth = Math.round((shot.naturalWidth / shot.naturalHeight) * Number(tall));

      const page_ = add(frame, "div", {
        display: docked ? "flex" : "none",
        position: "absolute",
        top: `${BAR}px`,
        left: "0",
        right: `${placedWidth}px`,
        bottom: "0",
        padding: "26px 24px",
        flexDirection: "column",
        gap: "14px",
        // A conversation is whole, so it doesn't fade like the page blocks behind it.
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
            fontFamily: '"Figtree", system-ui, sans-serif',
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

      const inner = frame.clientHeight - BAR;
      at(shot, {
        position: "absolute",
        display: "block",
        top: docked ? `${BAR + Math.round((inner - Number(tall)) / 2)}px` : `${BAR}px`,
        right: "0",
        width: docked ? `${placedWidth}px` : "100%",
        height: docked ? `${tall}px` : `${inner}px`,
        // A small radius keeps a docked panel from reading as pasted onto a soft-cornered window.
        borderRadius: docked ? "12px" : "0",
        boxShadow: docked ? "-18px 0 40px rgba(21, 22, 24, 0.10)" : "none",
      });
      frame.append(shot);

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
    },
    [
      image,
      PANEL_HEIGHT,
      INSET,
      BAR,
      WINDOW_LEFT,
      CHAT_WINDOW_LEFT,
      WINDOW_RIGHT,
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

// Rendered at twice the pixels and written at the store's own size, so text stays sharp.
const shoot = (page: Page, name: string): Promise<Buffer> =>
  page.screenshot({ path: path.join(SHOTS, `${name}.png`), animations: "disabled", scale: "css" });

// Benefits, the positive way round: docs/architecture/store-listing.md, "The screenshots".

test("a note in the panel, which is what saving something gets you", async ({ launcher, backendSimulator, page }) => {
  storeLibrary(backendSimulator);
  const image = await rendered(page, PANEL, async () => {
    const capture = await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: theBigPictureVideoUrl() });
    await capture.openStoredOverview();
  });
  await composed(page, image, {
    lead: "All the info,",
    accent: "less wait.",
    breakAtSplit: true,
    sub: "Videos, podcasts, articles, recipes and social posts become a short overview: the premise, the big picture, the core claim and what to do next.",
  });

  await shoot(page, "1-note");
});

test("a question across the whole library, answered in sections from what it holds", async ({ launcher, backendSimulator, page }) => {
  storeLibrary(backendSimulator);
  backendSimulator.chats.answerWith(storeAnswer());
  const image = await rendered(page, WIDE, async () => {
    await launcher.launchExpectingLibrary({ ...SIGNED_IN, showMilestoneCards: false });
    const ask = await launcher.appShell.openAsk();
    await ask.ask(STORE_QUESTION);
    await ask.verifyReadLineReads(0, `Read ${STORE_ANSWER_READ} overviews`);
  });
  await composed(
    page,
    image,
    {
      lead: "Ask your",
      accent: "whole library.",
      breakAtSplit: true,
      sub: "One question across everything you’ve saved, answered in sections, with every point linked to the overview it came from.",
    },
    { surface: "wide" },
  );

  await shoot(page, "2-ask");
});

test("every kind of source, in one library", async ({ launcher, backendSimulator, page }) => {
  storeLibrary(backendSimulator, oneOfEachKind());
  const image = await rendered(page, WIDE, async () => {
    await launcher.launchExpectingLibrary({ ...SIGNED_IN, showMilestoneCards: false });
  });
  await composed(
    page,
    image,
    {
      lead: "One library",
      accent: "for all of it.",
      breakAtSplit: true,
      sub: "Videos, podcasts, articles, recipes and social posts, in one library you can search, filter, and listen to on the way to work.",
    },
    { surface: "wide" },
  );

  await shoot(page, "3-sources");
});

test("cooking from a recipe, one step at a time", async ({ launcher, backendSimulator, page }) => {
  storeLibrary(backendSimulator, [theRecipe()]);
  backendSimulator.narration.seedReady(theRecipe());
  const image = await rendered(page, PANEL, async () => {
    await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null });
    await page.getByTestId(recentOverviewsTestIds.row).first().click();
    await page.getByTestId("RecipeMethod.cook").click();
    await expect(page.getByTestId("CookingMode.voice")).toHaveText("Waiting for you", { timeout: 15_000 });
    await page.getByTestId("CookingMode.forward").click();
    await expect(page.getByTestId("CookingMode.voice")).toHaveText("Waiting for you", { timeout: 15_000 });
  });
  await composed(page, image, {
    lead: "Cook without",
    accent: "the scrolling.",
    breakAtSplit: true,
    sub: "Recipes get a cooking mode, one step at a time: read aloud, with ingredients a tap away. Servings scaled, and units converted for you.",
  });

  await shoot(page, "4-cooking");
});

test("the connection, and the conversation it allows", async ({ launcher, backendSimulator, page }) => {
  storeLibrary(backendSimulator);
  backendSimulator.connections.seed(CLAUDE);
  const image = await rendered(page, PANEL, async () => {
    await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, followUpAssistant: "claude" });
    await (await launcher.appShell.openSettings()).openSection("connections");
  });
  await composed(
    page,
    image,
    {
      lead: "Hand your library",
      accent: "to your AI.",
      breakAtSplit: true,
      sub: "Connect your assistant and it can search everything you’ve saved, read any overview in full, and cite the moment a point was made.",
    },
    { surface: "chat", cites: [theDataNote().source.title, theSellingNote().source.title] },
  );

  await shoot(page, "5-assistant");
});
