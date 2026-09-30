import { Resvg } from "@resvg/resvg-js";
import { escapeHtml } from "./escapeHtml.js";
import { FONT_FILES } from "./shareFonts.js";

export interface MeasureTextInput {
  text: string;
  fontFamily: string;
  fontSize: number;
}

// Wide enough that nothing being measured is clipped before its box is read.
const PROBE_WIDTH = 20_000;

// Measured by the renderer that will draw it, so the width a line is wrapped to and the
// width it paints at cannot disagree. A second font library could
// (docs/prototype/constraints.md, "Never let a model count, measure or time anything").
export function measureText({ text, fontFamily, fontSize }: MeasureTextInput): number {
  if (text.trim() === "") {
    return 0;
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PROBE_WIDTH}" height="${fontSize * 4}">` +
    `<text x="0" y="${fontSize * 2}" font-family="${fontFamily}" font-size="${fontSize}">${escapeHtml(text)}</text>` +
    `</svg>`;
  const box = new Resvg(svg, { font: { fontFiles: FONT_FILES, loadSystemFonts: false } }).getBBox();
  return box === undefined || box === null ? 0 : box.x + box.width;
}
