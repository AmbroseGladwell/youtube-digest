import { expect } from "@playwright/experimental-ct-react";
import type { Locator } from "@playwright/test";
import { bottomSheetTestIds } from "../../src/components/shared/BottomSheet/BottomSheetTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

// The shared sheet's own behaviour, read through whichever sheet the locator names.
export class BottomSheetPageObject extends PageObject {
  private get sheet(): Locator {
    return this.locator!;
  }

  private panel = () => this.sheet.getByTestId(bottomSheetTestIds.panel);

  private settled = () =>
    this.sheet.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)));

  dragHandle = (by: number, durationMs: number) =>
    this.step(`dragHandle ${by}px over ${durationMs}ms`, async () => {
      await this.settled();
      const grip = (await this.sheet.getByTestId(bottomSheetTestIds.handle).boundingBox())!;
      const x = grip.x + grip.width / 2;
      const y = grip.y + 8;
      const steps = 8;
      await this.page.mouse.move(x, y);
      await this.page.mouse.down();
      for (let step = 1; step <= steps; step += 1) {
        await this.page.mouse.move(x, y + (by * step) / steps);
        if (durationMs > 0) {
          await this.page.waitForTimeout(durationMs / steps);
        }
      }
      await this.page.mouse.up();
    });

  clickClose = () => this.step("clickClose", () => this.click(this.sheet.getByTestId(bottomSheetTestIds.close)));

  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));

  verifyIsOpen = () => this.step("verifyIsOpen", () => expect(this.panel()).toBeVisible());

  verifyIsClosed = () => this.step("verifyIsClosed", () => expect(this.sheet).toHaveCount(0));

  verifyRestsAtTheBottom = () =>
    this.step("verifyRestsAtTheBottom", async () => {
      await this.settled();
      const panel = (await this.panel().boundingBox())!;
      const viewport = this.page.viewportSize()!;
      expect(Math.round(panel.y + panel.height)).toBe(viewport.height);
      expect(Math.round(panel.width)).toBe(viewport.width);
    });

  verifyFillsTheScreen = () =>
    this.step("verifyFillsTheScreen", async () => {
      await this.settled();
      const panel = (await this.panel().boundingBox())!;
      expect(Math.round(panel.y)).toBe(0);
      expect(Math.round(panel.height)).toBe(this.page.viewportSize()!.height);
    });

  verifyIsCentred = () =>
    this.step("verifyIsCentred", async () => {
      await this.settled();
      const panel = (await this.panel().boundingBox())!;
      const viewport = this.page.viewportSize()!;
      expect(Math.round(panel.x)).toBe(Math.round(viewport.width - (panel.x + panel.width)));
      expect(Math.round(panel.y + panel.height)).toBeLessThan(viewport.height);
      await expect(this.sheet.getByTestId(bottomSheetTestIds.bar)).not.toBeVisible();
    });

  private pageScrollY = () => this.page.evaluate(() => window.scrollY);

  private scrollThePage = async () => {
    await this.page.mouse.move(20, 20);
    await this.page.mouse.wheel(0, 600);
    await this.page.keyboard.press("PageDown");
  };

  verifyPageBehindStaysPut = () =>
    this.step("verifyPageBehindStaysPut", async () => {
      await this.settled();
      const before = await this.pageScrollY();
      await this.scrollThePage();
      await this.page.waitForTimeout(300);
      expect(await this.pageScrollY()).toBe(before);
    });

  verifyPageScrollsAgain = () =>
    this.step("verifyPageScrollsAgain", async () => {
      const before = await this.pageScrollY();
      await this.scrollThePage();
      await expect.poll(this.pageScrollY).toBeGreaterThan(before);
    });

  // Read as it starts to leave: the sheet is still there, travelling down.
  verifyLeavesByTravellingDown = () =>
    this.step("verifyLeavesByTravellingDown", async () => {
      await expect.poll(() => this.panel().evaluate((panel) => getComputedStyle(panel).animationName)).toMatch(/sheetAway/);
    });
}
