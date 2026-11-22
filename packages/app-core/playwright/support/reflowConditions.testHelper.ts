import type { Page } from "@playwright/test";

export const DEFAULT_TEXT_SIZE = 16;
export const DOUBLED_TEXT_SIZE = 32;

export interface ReflowCondition {
  name: string;
  viewport: { width: number; height: number };
  textSize: number;
  touch: boolean;
}

const LAPTOP = { width: 1280, height: 800 };
const FOUR_TIMES_ZOOM = 4;

export const reflowConditions: ReflowCondition[] = [
  {
    name: "at 400% zoom on a laptop",
    viewport: { width: LAPTOP.width / FOUR_TIMES_ZOOM, height: LAPTOP.height / FOUR_TIMES_ZOOM },
    textSize: DEFAULT_TEXT_SIZE,
    touch: false,
  },
  { name: "with 200% text on a laptop", viewport: LAPTOP, textSize: DOUBLED_TEXT_SIZE, touch: false },
  { name: "with 200% text on a phone", viewport: { width: 390, height: 844 }, textSize: DOUBLED_TEXT_SIZE, touch: true },
  { name: "on a phone in landscape", viewport: { width: 844, height: 390 }, textSize: DEFAULT_TEXT_SIZE, touch: true },
];

const pagesWithTextSizeChanged = new WeakSet<Page>();

export const setTextSize = async (page: Page, size: number): Promise<void> => {
  const devtools = await page.context().newCDPSession(page);
  await devtools.send("Page.setFontSizes", { fontSizes: { standard: size, fixed: Math.round(size * 0.8125) } });
  pagesWithTextSizeChanged.add(page);
};

export const resetTextSizeIfChanged = async (page: Page): Promise<void> => {
  if (pagesWithTextSizeChanged.has(page)) {
    await setTextSize(page, DEFAULT_TEXT_SIZE);
    pagesWithTextSizeChanged.delete(page);
  }
};

export const applyReflowCondition = async (page: Page, condition: ReflowCondition): Promise<void> => {
  await page.setViewportSize(condition.viewport);
  if (condition.touch) {
    const devtools = await page.context().newCDPSession(page);
    await devtools.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  }
  await setTextSize(page, condition.textSize);
};
