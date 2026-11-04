import { expect } from "@playwright/experimental-ct-react";
import { onboardingSamplesTestIds } from "../../src/features/onboarding/components/OnboardingSamples/OnboardingSamplesTestIds.js";
import { OnboardingPageObject } from "./OnboardingPageObject.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";
import type { SignInPageObject } from "./SignInPageObject.testHelper.js";

// Start's samples, on the web's Start and the panel's alike.
export class OnboardingSamplesPageObject extends PageObject {
  verifyOffers = (...names: Array<string | RegExp>) =>
    this.step("verifyOffers", async () => {
      await expect(this.page.getByRole("group", { name: "Or try a sample" })).toBeVisible();
      await expect(this.get(onboardingSamplesTestIds.sample)).toHaveCount(names.length);
      for (const [index, name] of names.entries()) {
        await expect(this.get(onboardingSamplesTestIds.sample).nth(index)).toHaveAccessibleName(name);
      }
    });

  verifyOffersNone = () => this.step("verifyOffersNone", () => this.expectNotToBeVisible(onboardingSamplesTestIds.root));

  choose = (title: string) =>
    this.step(`choose ${title}`, () => this.get(onboardingSamplesTestIds.sample).filter({ hasText: title }).click());

  verifySaysItCouldntOpen = () =>
    this.step("verifySaysItCouldntOpen", () => this.expectToBeVisible(onboardingSamplesTestIds.failed));

  // Every Create account goes through onboarding, and a sample is the quickest way to its
  // account screen: already made, so See your overview is there at once.
  createAccountThroughFirst = (): Promise<SignInPageObject> =>
    this.step("createAccountThroughFirst", async () => {
      await this.get(onboardingSamplesTestIds.sample).first().click();
      const onboarding = await new OnboardingPageObject(this.testContext).verifyIsShown();
      await onboarding.seeOverview();
      await onboarding.verifyOnScreen("account");
      return (await onboarding.continueWithEmail()).verifyAsksForEmail("Create your account");
    });
}
