import { expect } from "@playwright/experimental-ct-react";
import type { Plan } from "@overview/domain";
import { plansModalTestIds } from "../../src/features/plus/components/PlansModal/PlansModalTestIds.js";
import { planOfferCardTestIds } from "../../src/features/plus/components/PlanOfferCard/PlanOfferCardTestIds.js";
import { bottomSheetTestIds } from "../../src/components/shared/BottomSheet/BottomSheetTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

const CARDS = `[data-testid^="plan-offer-"]:not([data-testid$="-tell-me-when"])`;

export class PlansModalPageObject extends PageObject {
  verifyIsShown = () => this.step("verifyIsShown", () => expect(this.get(plansModalTestIds.root)).toBeVisible());

  verifyIsClosed = () => this.step("verifyIsClosed", () => expect(this.get(plansModalTestIds.root)).not.toBeVisible());

  verifyHeading = (heading: string) =>
    this.step(`verifyHeading ${heading}`, () =>
      expect(this.get(plansModalTestIds.root).getByRole("heading", { level: 2 })).toHaveText(heading),
    );

  verifyCardsRead = (cards: Array<{ plan: Plan; lines: string[] }>) =>
    this.step("verifyCardsRead", async () => {
      await expect(this.get(plansModalTestIds.root).locator(CARDS)).toHaveCount(cards.length);
      for (const { plan, lines } of cards) {
        for (const line of lines) {
          await expect(this.get(planOfferCardTestIds.card(plan))).toContainText(line);
        }
      }
    });

  verifyCardsInOrder = (plans: Plan[]) =>
    this.step(`verifyCardsInOrder ${plans.join(", ")}`, async () => {
      const ids = await this.get(plansModalTestIds.root)
        .locator(CARDS)
        .evaluateAll((cards) => cards.map((card) => card.getAttribute("data-testid")));
      expect(ids).toEqual(plans.map((plan) => planOfferCardTestIds.card(plan)));
    });

  chooseMonthly = () => this.step("chooseMonthly", () => this.click(this.get(`${plansModalTestIds.billing}-monthly`)));

  tellMeWhen = (plan: Plan) => this.step(`tellMeWhen ${plan}`, () => this.click(this.get(planOfferCardTestIds.tellMeWhen(plan))));

  verifyOnTheList = (plan: Plan) =>
    this.step(`verifyOnTheList ${plan}`, async () => {
      await expect(this.get(planOfferCardTestIds.tellMeWhen(plan))).toHaveText("On the list");
      await expect(this.get(planOfferCardTestIds.tellMeWhen(plan))).toHaveAttribute("aria-disabled", "true");
      await expect(this.get(plansModalTestIds.root).getByRole("status")).toContainText("on the list");
    });

  verifyFullHeight = () =>
    this.step("verifyFullHeight", async () => {
      const panel = this.get(plansModalTestIds.root).getByTestId(bottomSheetTestIds.panel);
      const viewport = this.page.viewportSize()!;
      await expect.poll(async () => Math.round((await panel.boundingBox())?.height ?? 0)).toBe(viewport.height);
    });

  close = () =>
    this.step("close", async () => {
      await this.click(this.get(plansModalTestIds.root).getByTestId(bottomSheetTestIds.close));
      await expect(this.get(plansModalTestIds.root)).toBeHidden();
    });
}
