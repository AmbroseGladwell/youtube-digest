import { expect } from "@playwright/experimental-ct-react";
import { onboardingNextStepsTestIds } from "../../src/features/onboarding/components/OnboardingNextSteps/OnboardingNextStepsTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class OnboardingNextStepsPageObject extends PageObject {
  verifyOffers = (steps: Array<"own" | "extension" | "ai">) =>
    this.step(`verifyOffers ${steps.join(", ")}`, async () => {
      for (const step of ["own", "extension", "ai"] as const) {
        if (steps.includes(step)) await this.expectToBeVisible(onboardingNextStepsTestIds.card(step));
        else await this.expectNotToBeVisible(onboardingNextStepsTestIds.card(step));
      }
    });

  tryYourOwn = (link: string) =>
    this.step(`tryYourOwn ${link}`, async () => {
      await this.get(onboardingNextStepsTestIds.ownField).fill(link);
      await this.click(onboardingNextStepsTestIds.action("own"));
    });

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectNotToBeVisible(onboardingNextStepsTestIds.root));

  verifyExtensionCantBeAddedYet = () =>
    this.step("verifyExtensionCantBeAddedYet", () => expect(this.get(onboardingNextStepsTestIds.action("extension"))).toBeDisabled());

  dismiss = (step: "own" | "extension" | "ai") => this.step(`dismiss ${step}`, () => this.click(onboardingNextStepsTestIds.dismiss(step)));

  connectYourAi = () => this.step("connectYourAi", () => this.click(onboardingNextStepsTestIds.action("ai")));
}
