import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = "apps/extension/store";
const MARK = "apps/extension/public/icons/icon.svg";
const FONTS = "https://fonts.googleapis.com/css2?family=Gloock&family=Figtree:wght@400;500;600&display=swap";

// tokens.scss's light palette, the same one the screenshots are composed in.
const GROUND = "#ece8e1";
const GRID = "rgba(21, 22, 24, 0.035)";
const INK = "#151618";
const MUTED = "#5f5c57";
const ACCENT = "#b03c12";

// The mark's own ink sits in a 32-unit box spanning x 7–25 and y 5.5–27.5, so it is 18 wide
// by 22 tall. The store wants 96px of artwork inside a 128px square, which means scaling by
// the taller side and centring what is left (docs/architecture/store-listing.md).
export const markBox = { x: 7, y: 5.5, width: 18, height: 22 };

export function artworkFit({ canvas, artwork, box = markBox }) {
  const scale = artwork / Math.max(box.width, box.height);
  const width = box.width * scale;
  const height = box.height * scale;
  return {
    width,
    height,
    left: (canvas - width) / 2,
    top: (canvas - height) / 2,
    viewBox: `${box.x} ${box.y} ${box.width} ${box.height}`,
  };
}

const markInner = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

function iconHtml(svg) {
  const fit = artworkFit({ canvas: 128, artwork: 96 });
  return `<style>html,body{margin:0;width:128px;height:128px;background:transparent}</style>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fit.viewBox}"
     style="position:absolute;left:${fit.left}px;top:${fit.top}px;width:${fit.width}px;height:${fit.height}px">
  ${markInner(svg)}
</svg>`;
}

function tileHtml(svg) {
  return `<link rel="stylesheet" href="${FONTS}">
<style>
  html,body{margin:0;width:440px;height:280px;overflow:hidden}
  body{
    background:
      linear-gradient(${GRID} 1px, transparent 1px) 0 0 / 40px 40px,
      linear-gradient(90deg, ${GRID} 1px, transparent 1px) 0 0 / 40px 40px,
      radial-gradient(120% 90% at 20% 15%, #f6f4f0 0%, ${GROUND} 65%);
    font-family:"Figtree",system-ui,sans-serif; color:${INK};
    display:flex; flex-direction:column; justify-content:space-between; padding:30px 34px; box-sizing:border-box;
  }
  .brand{display:flex;align-items:center;gap:9px;font-family:"Gloock",Georgia,serif;font-size:21px}
  .brand svg{width:23px;height:23px}
  h1{margin:0;font-family:"Gloock",Georgia,serif;font-weight:400;font-size:40px;line-height:1.04;letter-spacing:-0.01em}
  h1 span{color:${ACCENT}}
  p{margin:9px 0 0;font-size:14.5px;line-height:1.45;color:${MUTED};max-width:34ch}
</style>
<div class="brand">${svg}<span>The Overview</span></div>
<div>
  <h1>All the info,<br><span>less wait.</span></h1>
  <p>Bookmark videos, articles and recipes. Read the overview, hear it, or hand it to your AI.</p>
</div>`;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { chromium } = await import("playwright");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const svg = readFileSync(path.join(root, MARK), "utf8").replace(/width="\d+" height="\d+"/, "");
  mkdirSync(path.join(root, OUT), { recursive: true });

  const browser = await chromium.launch();
  try {
    const assets = [
      { file: "store-icon-128.png", width: 128, height: 128, html: iconHtml(svg), transparent: true },
      { file: "promo-tile-440x280.png", width: 440, height: 280, html: tileHtml(svg), transparent: false },
    ];
    for (const { file, width, height, html, transparent } of assets) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      await page.setContent(html);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(root, OUT, file), omitBackground: transparent });
      await page.close();
      console.log(`${OUT}/${file} (${width}×${height})`);
    }
  } finally {
    await browser.close();
  }
}
