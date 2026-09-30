import { Resvg } from "@resvg/resvg-js";
import { overviewMetaParts, type SharedNote } from "@overview/domain";
import { escapeHtml } from "./escapeHtml.js";
import { measureText } from "./measureText.js";
import { BODY_FONT_FAMILY, FONT_FILES, TITLE_FONT_FAMILY } from "./shareFonts.js";
import { wrapToWidth } from "./wrapToWidth.js";

// 1200×630 is what every unfurler crops to, and twice the 600×315 the design draws
// (OV-30 Shared Page, 30i).
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const PADDING_X = 80;
const PADDING_Y = 68;
const FIELD = "#F6F4F0";
const INK = "#151618";
const QUIET_INK = "#5F5C57";
const ACCENT = "#E2511E";

const BRAND_SIZE = 40;
const BRAND_BASELINE = 108;
const MARK_SIZE = 40;

const TITLE_SIZE = 84;
const TITLE_LINE_HEIGHT = Math.round(TITLE_SIZE * 1.08);
const TITLE_MAX_LINES = 3;
// Far enough above the meta line that a descender on the last line clears it.
const TITLE_BASELINE = 476;

const META_SIZE = 30;
const META_BASELINE = CARD_HEIGHT - PADDING_Y;

const CONTENT_WIDTH = CARD_WIDTH - PADDING_X * 2;

const text = (content: string, x: number, y: number, size: number, family: string, fill: string) =>
  `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" fill="${fill}">${escapeHtml(content)}</text>`;

// The mark as the favicon draws it, in its own coordinate space.
const mark = (x: number, y: number) =>
  `<svg x="${x}" y="${y}" width="${MARK_SIZE}" height="${MARK_SIZE}" viewBox="0 0 32 32">` +
  `<circle cx="16" cy="14.5" r="7.5" fill="none" stroke="${ACCENT}" stroke-width="3"/>` +
  `<rect x="7" y="25" width="18" height="2.5" fill="${ACCENT}"/>` +
  `</svg>`;

// Everything on the card comes from the shared copy, which is why it can be drawn from the
// snapshot alone and never goes stale (docs/features/sharing.md).
export function shareCardSvg(note: SharedNote): string {
  const titleLines = wrapToWidth({
    text: note.video.title,
    maxWidth: CONTENT_WIDTH,
    maxLines: TITLE_MAX_LINES,
    measure: (line) => measureText({ text: line, fontFamily: TITLE_FONT_FAMILY, fontSize: TITLE_SIZE }),
  });
  const [metaLine = ""] = wrapToWidth({
    text: [note.video.channel, ...overviewMetaParts(note)].join(" · "),
    maxWidth: CONTENT_WIDTH,
    maxLines: 1,
    measure: (line) => measureText({ text: line, fontFamily: BODY_FONT_FAMILY, fontSize: META_SIZE }),
  });

  const titles = titleLines.map((line, index) =>
    text(
      line,
      PADDING_X,
      TITLE_BASELINE - (titleLines.length - 1 - index) * TITLE_LINE_HEIGHT,
      TITLE_SIZE,
      TITLE_FONT_FAMILY,
      INK,
    ),
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">`,
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${FIELD}"/>`,
    mark(PADDING_X, BRAND_BASELINE - MARK_SIZE + 8),
    text("The Overview", PADDING_X + MARK_SIZE + 14, BRAND_BASELINE, BRAND_SIZE, TITLE_FONT_FAMILY, INK),
    ...titles,
    text(metaLine, PADDING_X, META_BASELINE, META_SIZE, BODY_FONT_FAMILY, QUIET_INK),
    "</svg>",
  ].join("");
}

export async function shareCardPng(note: SharedNote): Promise<Buffer> {
  const resvg = new Resvg(shareCardSvg(note), {
    fitTo: { mode: "width", value: CARD_WIDTH },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: BODY_FONT_FAMILY },
  });
  return Buffer.from(resvg.render().asPng());
}
