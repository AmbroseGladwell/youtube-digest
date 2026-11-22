import { expect } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import { headImageTestIds } from "../../src/features/reader/components/HeadImage/HeadImageTestIds.js";
import type { TestContext } from "../support/TestContext.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";

export class HeadImagePageObject extends PageObject {
  private readonly title: Locator;

  constructor(testContext: TestContext, head: Locator, title: Locator) {
    super(testContext, head);
    this.title = title;
  }

  private button = () => this.get(headImageTestIds.button);

  verifyShown = (shown: boolean) => this.step(`verifyShown ${shown}`, () => expect(this.button()).toHaveCount(shown ? 1 : 0));

  // Measured once the grow has settled: mid-way, the transform is part of the box.
  verifySize = (width: number, height: number) =>
    this.step(`verifySize ${width}x${height}`, async () => {
      await expect.poll(async () => Math.round((await this.button().boundingBox())!.width)).toBe(Math.round(width));
      const box = (await this.button().boundingBox())!;
      expect(box.height).toBeCloseTo(height, 0);
    });

  verifyIsFullWidth = () =>
    this.step("verifyIsFullWidth", async () => {
      const title = (await this.title.boundingBox())!;
      await expect.poll(async () => Math.round((await this.button().boundingBox())!.width)).toBe(Math.round(title.width));
      const image = (await this.button().boundingBox())!;
      expect(Math.round(image.x)).toBe(Math.round(title.x));
      expect(image.height).toBeCloseTo((image.width * 9) / 16, 0);
    });

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

  // The grow starts once the press re-renders the head, which can lag the click, so it is polled.
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
      if (shown) {
        await expect(sharp).toBeVisible();
      } else {
        await expect(sharp).not.toBeVisible();
      }
    });

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
