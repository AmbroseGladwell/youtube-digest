import { expect } from "@playwright/experimental-ct-react";
import { onboardingSamplesTestIds } from "../../src/features/onboarding/components/OnboardingSamples/OnboardingSamplesTestIds.js";
import { sampleRowTestIds } from "../../src/features/onboarding/components/SampleRow/SampleRowTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

// Start's samples as rows: the panel's, and the web's when there are too few for a deck (155d).
export class OnboardingSamplesPageObject extends PageObject {
  #rows = () => this.get(onboardingSamplesTestIds.root).getByTestId(sampleRowTestIds.root);

  verifyOffers = (...names: Array<string | RegExp>) =>
    this.step("verifyOffers", async () => {
      await expect(this.page.getByRole("group", { name: "Or try a sample" })).toBeVisible();
      await expect(this.#rows()).toHaveCount(names.length);
      for (const [index, name] of names.entries()) {
        await expect(this.#rows().nth(index)).toHaveAccessibleName(name);
      }
    });

  verifyOffersNone = () => this.step("verifyOffersNone", () => this.expectNotToBeVisible(onboardingSamplesTestIds.root));

  verifyMoreReads = (label: "More samples" | "Fewer samples" | null) =>
    this.step(`verifyMoreReads ${label}`, async () => {
      if (label === null) await this.expectNotToBeVisible(onboardingSamplesTestIds.more);
      else {
        await expect(this.get(onboardingSamplesTestIds.more)).toHaveText(label);
        await expect(this.get(onboardingSamplesTestIds.more)).toHaveAttribute("aria-expanded", String(label === "Fewer samples"));
      }
    });

  toggleMore = () => this.step("toggleMore", () => this.click(onboardingSamplesTestIds.more));

  verifyFocusOn = (title: string) =>
    this.step(`verifyFocusOn ${title}`, () => expect(this.#rows().filter({ hasText: title })).toBeFocused());

  choose = (title: string) => this.step(`choose ${title}`, () => this.#rows().filter({ hasText: title }).click());

  verifyOpening = (title: string) =>
    this.step(`verifyOpening ${title}`, () =>
      expect(this.#rows().filter({ hasText: title }).getByTestId(sampleRowTestIds.opening)).toBeVisible(),
    );

  verifySaysItCouldntOpen = () => this.step("verifySaysItCouldntOpen", () => this.expectToBeVisible(onboardingSamplesTestIds.failed));
}
