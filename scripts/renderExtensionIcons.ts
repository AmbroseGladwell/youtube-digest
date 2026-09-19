import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Chrome's manifest takes raster icons only, so icon.svg is the source and the PNGs beside
// it are committed build output (apps/extension/public/icons/README.md).
const SIZES = [16, 32, 48, 128];

const iconsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../apps/extension/public/icons",
);

const svg = await readFile(path.join(iconsDirectory, "icon.svg"), "utf8");

const browser = await chromium.launch();
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await writeFile(path.join(iconsDirectory, `icon${size}.png`), await page.screenshot());
    await page.close();
    console.error(`rendered icon${size}.png`);
  }
} finally {
  await browser.close();
}
