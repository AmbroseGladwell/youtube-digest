import { expect } from "@playwright/experimental-ct-react";
import type { Plan } from "@overview/domain";
import { plansModalTestIds } from "../../src/features/plus/components/PlansModal/PlansModalTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

// Every plan side by side, with paying for one not open yet (design 327ah).
export class PlansModalPageObject extends PageObject {
  verifyIsShown = () => this.step("verifyIsShown", () => expect(this.get(plansModalTestIds.root)).toBeVisible());

  verifyIsClosed = () => this.step("verifyIsClosed", () => expect(this.get(plansModalTestIds.root)).not.toBeVisible());

  verifyCardsRead = (cards: Array<{ plan: Plan; lines: string[] }>) =>
    this.step("verifyCardsRead", async () => {
      await expect(this.get(plansModalTestIds.root).locator(`[data-testid^="plans-modal-card-"]`)).toHaveCount(cards.length);
      for (const { plan, lines } of cards) {
        for (const line of lines) await expect(this.get(plansModalTestIds.card(plan))).toContainText(line);
      }
    });

  verifyCardsInOrder = (plans: Plan[]) =>
    this.step(`verifyCardsInOrder ${plans.join(", ")}`, async () => {
      const ids = await this.get(plansModalTestIds.root)
        .locator(`[data-testid^="plans-modal-card-"]`)
        .evaluateAll((cards) => cards.map((card) => card.getAttribute("data-testid")));
      expect(ids).toEqual(plans.map((plan) => plansModalTestIds.card(plan)));
    });

  verifyPayingOpensSoon = (plan: Plan) =>
    this.step(`verifyPayingOpensSoon ${plan}`, async () => {
      await expect(this.get(plansModalTestIds.choose(plan))).toBeDisabled();
      await expect(this.get(plansModalTestIds.choose(plan))).toHaveAccessibleDescription("Paying for a plan opens soon.");
    });

  verifyCannotChoose = (plan: Plan) =>
    this.step(`verifyCannotChoose ${plan}`, () => this.expectToHaveCount(plansModalTestIds.choose(plan), 0));

  close = () => this.step("close", () => this.click(plansModalTestIds.close));
}
