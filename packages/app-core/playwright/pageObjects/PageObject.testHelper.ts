import { test, expect } from "@playwright/experimental-ct-react";
import type { Locator, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { TestContext } from "../support/TestContext.testHelper.js";
import { DEFAULT_TEXT_SIZE, DOUBLED_TEXT_SIZE, setTextSize } from "../support/reflowConditions.testHelper.js";
import {
  MOST_OF_THE_SCREEN_BARS_MAY_COVER,
  SMALLEST_GROWTH_AT_DOUBLED_TEXT,
  SMALLEST_SCROLL_WINDOW,
  clippedScrollPositions,
  measureBarCover,
  sampleTextSizes,
  scrollWindowsTooShort,
} from "../support/reflowMeasures.testHelper.js";

const REACHABLE_CONTROLS = ["button", "a[href]", "input", "select", "textarea", "[role=menuitem]", "[role=option]", "[role=tab]"]
  .map((control) => `${control}:not([disabled]):not([aria-disabled=true])`)
  .join(", ");
export interface AxeAllowance {
  rule: string;
  testId: string;
}

const isAllowed = (allowed: AxeAllowance[], rule: string, html: string) =>
  allowed.some((allowance) => allowance.rule === rule && html.includes(`data-testid="${allowance.testId}"`));

const REACH_MARK = "data-reach-check";
const LONGEST_WAIT_FOR_ANIMATIONS_MS = 2_000;
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const TEXT_LIKE_FIELDS =
  "input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=submit]):not([type=button]), textarea, select";

export abstract class PageObject {
  protected readonly name: string;
  readonly testContext: TestContext;
  protected readonly locator?: Locator | undefined;

  constructor(testContext: TestContext, locator?: Locator) {
    this.testContext = testContext;
    this.locator = locator;

    const constructorName = this.constructor.name;
    if (!constructorName.endsWith("PageObject")) {
      throw new Error(`Expected constructor name to end with 'PageObject', but got: ${constructorName}`);
    }
    this.name = constructorName.slice(0, -"PageObject".length);
  }

  get page(): Page {
    return this.testContext.page;
  }

  protected step = <T>(name: string, body: () => T | Promise<T>): Promise<T> => test.step(`${this.name}.${name}`, body);

  protected get = (testId: string): Locator => this.locatorOrPage().getByTestId(testId);
  protected locatorOrPage = (): Locator | Page => this.locator ?? this.page;

  protected click = (target: string | Locator) => this.resolveLocator(target).click();
  protected resolveLocator = (target: string | Locator): Locator => (typeof target === "string" ? this.get(target) : target);

  protected expectToBeVisible = (testId: string) => expect(this.get(testId)).toBeVisible();
  protected expectNotToBeVisible = (testId: string) => expect(this.get(testId)).not.toBeVisible();
  protected expectToHaveCount = (testId: string, count: number) => expect(this.get(testId)).toHaveCount(count);

  // Reads the generated box: every band carries the attribute and a stylesheet picks between them.
  private stickyFades = () =>
    this.page.evaluate(() =>
      [...document.querySelectorAll("[data-sticky-fade]")].map((band) => {
        const fade = getComputedStyle(band, "::after");
        return {
          band: (band as HTMLElement).dataset.testid ?? band.tagName.toLowerCase(),
          drawn: fade.content !== "none",
          height: fade.height,
          opacity: Number(fade.opacity),
          catchesClicks: fade.pointerEvents !== "none",
          hangsBelow: Math.abs(parseFloat(fade.top) - band.getBoundingClientRect().height),
        };
      }),
    );

  verifyFadeHangsFrom = (testId: string) =>
    this.step(`verifyFadeHangsFrom ${testId}`, async () => {
      const bands = await this.stickyFades();
      expect(bands.filter((band) => band.drawn).map((band) => band.band)).toEqual([testId]);
      const fade = bands.find((band) => band.drawn)!;
      expect(fade.height).toBe("16px");
      expect(fade.catchesClicks).toBe(false);
      expect(fade.hangsBelow).toBeLessThan(1);
    });

  verifyFadeStopsShortOf = (testId: string) =>
    this.step(`verifyFadeStopsShortOf ${testId}`, async () => {
      const startsAt = await this.get(testId).evaluate((element) => element.getBoundingClientRect().left);
      const fadeEndsAt = await this.page.evaluate(() => {
        const band = [...document.querySelectorAll("[data-sticky-fade]")].find(
          (each) => getComputedStyle(each, "::after").content !== "none",
        )!;
        return band.getBoundingClientRect().right - parseFloat(getComputedStyle(band, "::after").right);
      });
      expect(fadeEndsAt).toBeLessThanOrEqual(startsAt);
    });

  verifyStickyBandsAre = (testIds: string[]) =>
    this.step(`verifyStickyBandsAre ${testIds.join(", ")}`, async () => {
      expect((await this.stickyFades()).map((band) => band.band)).toEqual(testIds);
    });

  verifyAnchorsClearTheFade = (testId: string) =>
    this.step(`verifyAnchorsClearTheFade ${testId}`, async () => {
      const band = await this.page.evaluate(() => {
        const lowest = document.querySelector("[data-sticky-fade]")!;
        return {
          height: lowest.getBoundingClientRect().height,
          fade: parseFloat(getComputedStyle(lowest, "::after").height),
        };
      });
      const restsAt = await this.get(testId).evaluate((element) => parseFloat(getComputedStyle(element).scrollMarginTop));
      expect(restsAt).toBeGreaterThanOrEqual(band.height + band.fade);
    });

  verifyFadeIsShown = (shown: boolean) =>
    this.step(`verifyFadeIsShown ${shown}`, () =>
      expect.poll(async () => (await this.stickyFades()).find((band) => band.drawn)?.opacity, { timeout: 2_000 }).toBe(shown ? 1 : 0),
    );

  scrollToTheFoot = () =>
    this.step("scrollToTheFoot", () =>
      expect(async () => {
        await this.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const atTheFoot = await this.page.evaluate(
          () => window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1,
        );
        expect(atTheFoot).toBe(true);
      }).toPass({ timeout: 2_000 }),
    );

  scrollToTheTop = () =>
    this.step("scrollToTheTop", async () => {
      await this.page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => this.page.evaluate(() => window.scrollY), { timeout: 2_000 }).toBe(0);
    });

  verifyPageDoesNotScrollSideways = () =>
    this.step("verifyPageDoesNotScrollSideways", async () => {
      const overflow = await this.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

  verifyReflows = () =>
    this.step("verifyReflows", async () => {
      const overflow = await this.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(
        overflow,
        "the page scrolls sideways: something holds a fixed width wider than the screen; let it wrap or shrink",
      ).toBeLessThanOrEqual(0);
      const cover = await this.page.evaluate(measureBarCover);
      if (cover) {
        expect(
          cover.share,
          `fixed and sticky bars cover ${Math.round(cover.share * 100)}% of the screen (${cover.bars.map((bar) => bar.bar).join(", ")}); on a short screen let them scroll away or fold`,
        ).toBeLessThanOrEqual(MOST_OF_THE_SCREEN_BARS_MAY_COVER);
      }
    });

  verifyControlsCanBeReached = (within: Locator) =>
    this.step("verifyControlsCanBeReached", async () => {
      await this.page.mouse.move(0, 0);
      const count = await within
        .locator(REACHABLE_CONTROLS)
        .filter({ visible: true })
        .evaluateAll((controls, mark) => {
          controls.forEach((control, at) => control.setAttribute(mark, String(at)));
          return controls.length;
        }, REACH_MARK);
      expect(count).toBeGreaterThan(0);
      const unreachable: string[] = [];
      for (let at = 0; at < count; at++) {
        const control = within.locator(`[${REACH_MARK}="${at}"]`);
        const before = await control.evaluate(clippedScrollPositions);
        await control.focus();
        const reached = await control.click({ trial: true, timeout: 2_000 }).then(
          () => true,
          () => false,
        );
        const after = await control.evaluate(clippedScrollPositions);
        if (!reached || before.join() !== after.join()) {
          unreachable.push((await control.getAttribute("data-testid")) ?? (await control.innerText()).slice(0, 40));
        }
      }
      expect(
        unreachable,
        "these controls can't be scrolled to or tapped: give the overlay a max-height in dvh and overflow-y: auto",
      ).toEqual([]);
      const tooShort = await within.evaluate(scrollWindowsTooShort, SMALLEST_SCROLL_WINDOW);
      expect(tooShort, "this scroll area shows too little to use: let fixed parts around it shrink or scroll with it").toEqual([]);
    });

  verifyTextFollowsTheTextSetting = () =>
    this.step("verifyTextFollowsTheTextSetting", async () => {
      const viewport = this.page.viewportSize()!;
      const before = await this.page.evaluate(sampleTextSizes, true);
      await this.page.setViewportSize({ width: viewport.width * 2, height: viewport.height * 2 });
      await setTextSize(this.page, DOUBLED_TEXT_SIZE);
      const after = await this.page.evaluate(sampleTextSizes, false);
      await setTextSize(this.page, DEFAULT_TEXT_SIZE);
      await this.page.setViewportSize(viewport);
      expect(before.length).toBeGreaterThan(0);
      const stuck = before.flatMap((sample, at) => {
        const grown = after[at];
        return sample && grown && grown.size < sample.size * SMALLEST_GROWTH_AT_DOUBLED_TEXT ? [`${sample.text} (${sample.size}px)`] : [];
      });
      expect([...new Set(stuck)].slice(0, 10), "this text ignores the browser's text size: set font-size in rem, never px").toEqual([]);
    });

  verifyIsAccessible = (allowed: AxeAllowance[] = []) =>
    this.step("verifyIsAccessible", async () => {
      await this.page.evaluate((longestWait) => {
        const finite = document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity);
        const settled = Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)));
        return Promise.race([settled, new Promise((resolve) => setTimeout(resolve, longestWait))]);
      }, LONGEST_WAIT_FOR_ANIMATIONS_MS);
      await expect(async () => {
        const results = await new AxeBuilder({ page: this.page }).withTags(WCAG_AA).disableRules(["scrollable-region-focusable"]).analyze();
        const found = results.violations
          .map((violation) => ({ ...violation, nodes: violation.nodes.filter((node) => !isAllowed(allowed, violation.id, node.html)) }))
          .filter((violation) => violation.nodes.length > 0);
        expect(found.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
      }).toPass({ timeout: 5_000 });
    });

  verifyFieldFontSizes = (check: (sizesInPx: number[]) => void) =>
    this.step("verifyFieldFontSizes", async () => {
      const sizes = await this.locatorOrPage()
        .locator("input, textarea, select")
        .evaluateAll((fields) => fields.map((field) => parseFloat(getComputedStyle(field).fontSize)));
      expect(sizes.length).toBeGreaterThan(0);
      check(sizes);
    });

  verifyFieldsIdentifyThemselves = () =>
    this.step("verifyFieldsIdentifyThemselves", async () => {
      await expect(this.locatorOrPage().locator(TEXT_LIKE_FIELDS).first()).toBeAttached();
      const fields = await this.locatorOrPage()
        .locator(TEXT_LIKE_FIELDS)
        .evaluateAll((fields) =>
          fields.map((field) => ({
            field: field.getAttribute("data-testid") ?? field.outerHTML,
            name: field.getAttribute("name") ?? "",
            id: field.id,
            labelled:
              ((field as HTMLInputElement).labels?.length ?? 0) > 0 ||
              field.hasAttribute("aria-label") ||
              field.hasAttribute("aria-labelledby"),
            autocomplete: field.getAttribute("autocomplete") ?? "",
          })),
        );
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.filter((field) => !field.name || !field.id || !field.labelled || !field.autocomplete)).toEqual([]);
      const ids = fields.map((field) => field.id);
      expect(ids).toEqual([...new Set(ids)]);
    });

  verifyFieldAttributes = (name: string, attributes: Record<string, string>) =>
    this.step(`verifyFieldAttributes ${name}`, async () => {
      const named = this.locatorOrPage().locator(`[name="${name}"]`);
      await expect(named.first()).toBeAttached();
      for (const field of await named.all()) {
        for (const [attribute, value] of Object.entries(attributes)) {
          await expect(field).toHaveAttribute(attribute, value);
        }
      }
    });
}
