import { test, expect } from "@playwright/experimental-ct-react";
import type { Locator, Page } from "@playwright/test";
import type { TestContext } from "../support/TestContext.testHelper.js";

const TEXT_LIKE_FIELDS =
  "input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=submit]):not([type=button]), textarea, select";

export abstract class PageObject {
  protected readonly name: string;

  constructor(
    readonly testContext: TestContext,
    protected readonly locator?: Locator,
  ) {
    const constructorName = this.constructor.name;
    if (!constructorName.endsWith("PageObject")) {
      throw new Error(`Expected constructor name to end with 'PageObject', but got: ${constructorName}`);
    }
    this.name = constructorName.slice(0, -"PageObject".length);
  }

  get page(): Page {
    return this.testContext.page;
  }

  protected step = <T>(name: string, body: () => T | Promise<T>): Promise<T> =>
    test.step(`${this.name}.${name}`, body);

  protected get = (testId: string): Locator => this.locatorOrPage().getByTestId(testId);
  protected locatorOrPage = (): Locator | Page => this.locator ?? this.page;

  protected click = (target: string | Locator) => this.resolveLocator(target).click();
  protected resolveLocator = (target: string | Locator): Locator =>
    typeof target === "string" ? this.get(target) : target;

  protected expectToBeVisible = (testId: string) => expect(this.get(testId)).toBeVisible();
  protected expectNotToBeVisible = (testId: string) => expect(this.get(testId)).not.toBeVisible();
  protected expectToHaveCount = (testId: string, count: number) => expect(this.get(testId)).toHaveCount(count);

  // Reads the generated box, not the attribute: every band carries the attribute and a
  // stylesheet picks between them (docs/features/fade-under-the-bar.md).
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

  verifyStickyBandsAre = (testIds: string[]) =>
    this.step(`verifyStickyBandsAre ${testIds.join(", ")}`, async () => {
      expect((await this.stickyFades()).map((band) => band.band)).toEqual(testIds);
    });

  // What the fade's height is capped by: scrolled to its own anchor, a heading comes to rest
  // its scroll margin below the viewport's top, which has to clear the band and the fade
  // under it (docs/features/fade-under-the-bar.md).
  verifyAnchorsClearTheFade = (testId: string) =>
    this.step(`verifyAnchorsClearTheFade ${testId}`, async () => {
      const band = await this.page.evaluate(() => {
        const lowest = document.querySelector("[data-sticky-fade]")!;
        return {
          height: lowest.getBoundingClientRect().height,
          fade: parseFloat(getComputedStyle(lowest, "::after").height),
        };
      });
      const restsAt = await this.get(testId).evaluate((element) =>
        parseFloat(getComputedStyle(element).scrollMarginTop),
      );
      expect(restsAt).toBeGreaterThanOrEqual(band.height + band.fade);
    });

  verifyFadeIsShown = (shown: boolean) =>
    this.step(`verifyFadeIsShown ${shown}`, () =>
      expect
        .poll(async () => (await this.stickyFades()).find((band) => band.drawn)?.opacity, { timeout: 2_000 })
        .toBe(shown ? 1 : 0),
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
      const overflow = await this.page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
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
