import { expect } from "@playwright/experimental-ct-react";
import { sampleDeckTestIds } from "../../src/features/onboarding/components/SampleDeck/SampleDeckTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

// Web Start's sample deck (155l): one card in front, cycling, and See all to lay it out as a list.
export class SampleDeckPageObject extends PageObject {
  #front = () => this.page.locator(`[data-testid="${sampleDeckTestIds.card}"][data-front]`);
  #cards = () => this.get(sampleDeckTestIds.card);

  verifyIsShown = () => this.step("verifyIsShown", () => this.expectToBeVisible(sampleDeckTestIds.root));

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectNotToBeVisible(sampleDeckTestIds.root));

  verifyFront = (name: string | RegExp, position: string) =>
    this.step(`verifyFront ${String(name)}`, async () => {
      await expect(this.#front()).toHaveAccessibleName(name);
      await expect(this.get(sampleDeckTestIds.counter)).toHaveText(position);
    });

  // Only the front card is in the tab order while the deck is stacked.
  verifyOnlyFrontIsFocusable = (count: number) =>
    this.step("verifyOnlyFrontIsFocusable", async () => {
      await expect(this.#cards()).toHaveCount(count);
      await expect(this.page.locator(`[data-testid="${sampleDeckTestIds.card}"][tabindex="0"]`)).toHaveCount(1);
    });

  next = () => this.step("next", () => this.click(sampleDeckTestIds.next));

  previous = () => this.step("previous", () => this.click(sampleDeckTestIds.previous));

  verifyPlaying = (playing: boolean) =>
    this.step(`verifyPlaying ${playing}`, () =>
      expect(this.get(sampleDeckTestIds.playPause)).toHaveAccessibleName(playing ? "Pause samples" : "Play samples"),
    );

  playOrPause = () => this.step("playOrPause", () => this.click(sampleDeckTestIds.playPause));

  seeAll = () => this.step("seeAll", () => this.click(sampleDeckTestIds.toggle));

  verifyLaidOut = (names: string[]) =>
    this.step("verifyLaidOut", async () => {
      await expect(this.get(sampleDeckTestIds.toggle)).toHaveAttribute("aria-expanded", "true");
      await expect(this.page.locator(`[data-testid="${sampleDeckTestIds.card}"][tabindex="0"]`)).toHaveCount(names.length);
      await this.expectNotToBeVisible(sampleDeckTestIds.counter);
      // Laid out in deck order, front card first: read the rows top to bottom.
      await expect
        .poll(async () => {
          const rows = await this.#cards().evaluateAll((cards) =>
            cards.map((card) => ({ name: card.getAttribute("aria-label") ?? "", top: card.getBoundingClientRect().top })),
          );
          return rows.sort((a, b) => a.top - b.top).map(({ name }) => name);
        })
        .toEqual(names);
    });

  openFront = () => this.step("openFront", () => this.#front().click());

  verifyOpening = () =>
    this.step("verifyOpening", async () => {
      await expect(this.#front()).toHaveAttribute("aria-busy", "true");
      await expect(this.#front()).toContainText("Opening…");
    });

  verifySaysItCouldntOpen = () =>
    this.step("verifySaysItCouldntOpen", async () => {
      await this.expectToBeVisible(sampleDeckTestIds.failed);
      await expect(this.#front()).toBeFocused();
    });
}
