import { expect } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import { headImageTestIds } from "../../src/features/reader/components/HeadImage/HeadImageTestIds.js";
import type { TestContext } from "../support/TestContext.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";

// The image at the top of a note, on the reader's page and on a shared one: a button that
// swaps it between the tile and the column's width (OV-151), measured against the head it
// leads and the title under it.
export class HeadImagePageObject extends PageObject {
  constructor(
    testContext: TestContext,
    head: Locator,
    private readonly title: Locator,
  ) {
    super(testContext, head);
  }

  private button = () => this.get(headImageTestIds.button);

  verifyShown = (shown: boolean) =>
    this.step(`verifyShown ${shown}`, () => expect(this.button()).toHaveCount(shown ? 1 : 0));

  // Measured once the grow has settled: mid-way, the transform is part of the box.
  verifySize = (width: number, height: number) =>
    this.step(`verifySize ${width}x${height}`, async () => {
      await expect.poll(async () => Math.round((await this.button().boundingBox())!.width)).toBe(Math.round(width));
      const box = (await this.button().boundingBox())!;
      expect(box.height).toBeCloseTo(height, 0);
    });

  // Design 151b: full width is the reading column, which the title also spans.
  verifyIsFullWidth = () =>
    this.step("verifyIsFullWidth", async () => {
      const title = (await this.title.boundingBox())!;
      await expect.poll(async () => Math.round((await this.button().boundingBox())!.width)).toBe(Math.round(title.width));
      const image = (await this.button().boundingBox())!;
      expect(Math.round(image.x)).toBe(Math.round(title.x));
      expect(image.height).toBeCloseTo((image.width * 9) / 16, 0);
    });

  // Design 151a and 151r: the image is a named button that says which way it will go, and
  // still not a link; the picture inside it stays silent.
  verifyOffers = (size: "small" | "full") =>
    this.step(`verifyOffers ${size}`, async () => {
      const button = this.button();
      await expect(button).toHaveAccessibleName(size === "full" ? "Show the image full width" : "Show the image small");
      await expect(button).toHaveAttribute("aria-pressed", size === "full" ? "false" : "true");
      await expect(button.getByTestId(headImageTestIds.image)).toHaveAttribute("alt", "");
      await expect(this.locatorOrPage().locator("a:has(img)")).toHaveCount(0);
      await expect(button).toHaveCSS("opacity", "1");
    });

  clickImage = () => this.step("clickImage", () => this.button().click());

  // Design 151l and 151m, read straight after the press: the image grows as a transform, or
  // with reduced motion it swaps without moving.
  // The grow starts once the press has re-rendered the head, which can be a moment after the
  // click returns, so it is looked for until it shows rather than once.
  verifyGrows = (grows: boolean) =>
    this.step(`verifyGrows ${grows}`, async () => {
      const running = () => this.button().evaluate((button) => button.getAnimations().length);
      if (grows) {
        await expect.poll(running, { intervals: [10], timeout: 2_000 }).toBeGreaterThan(0);
      } else {
        expect(await running()).toBe(0);
      }
    });

  pressFromKeyboard = (key: "Enter" | " ") =>
    this.step(`pressFromKeyboard ${key}`, async () => {
      await this.button().focus();
      await this.page.keyboard.press(key === " " ? "Space" : key);
    });

  verifyHasFocus = () => this.step("verifyHasFocus", () => expect(this.button()).toBeFocused());

  verifyIconShown = (shown: boolean) =>
    this.step(`verifyIconShown ${shown}`, () =>
      expect(this.button().getByTestId(headImageTestIds.veil)).toHaveCSS("opacity", shown ? "1" : "0"),
    );

  hoverImage = () => this.step("hoverImage", () => this.button().hover());

  verifySharperShown = (shown: boolean) =>
    this.step(`verifySharperShown ${shown}`, async () => {
      const sharp = this.button().getByTestId(headImageTestIds.sharpImage);
      if (shown) await expect(sharp).toBeVisible();
      else await expect(sharp).not.toBeVisible();
    });

  // Design 147s: who it's from sits beside the image, and the title starts under both at
  // the image's left edge, so it keeps the column's whole measure.
  verifyLeadsWith = (who: Locator) =>
    this.step("verifyLeadsWith", async () => {
      const image = (await this.button().boundingBox())!;
      const beside = (await who.boundingBox())!;
      const title = (await this.title.boundingBox())!;
      expect(beside.x).toBeGreaterThan(image.x + image.width);
      expect(beside.y).toBeGreaterThanOrEqual(image.y);
      expect(beside.y + beside.height).toBeLessThanOrEqual(image.y + image.height + 1);
      expect(title.y).toBeGreaterThanOrEqual(image.y + image.height);
      expect(Math.round(title.x)).toBe(Math.round(image.x));
    });

  // Design 151b: at full width who it's from goes back to its own line under the image.
  verifyAbove = (who: Locator) =>
    this.step("verifyAbove", async () => {
      await expect.poll(async () => who.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
      const image = (await this.button().boundingBox())!;
      const under = (await who.boundingBox())!;
      const title = (await this.title.boundingBox())!;
      expect(under.y).toBeGreaterThanOrEqual(image.y + image.height);
      expect(title.y).toBeGreaterThanOrEqual(under.y + under.height);
    });
}
