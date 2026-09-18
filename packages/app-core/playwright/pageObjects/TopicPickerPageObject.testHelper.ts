import { expect } from "@playwright/experimental-ct-react";
import { topicPickerTestIds } from "../../src/features/reader/components/TopicPicker/TopicPickerTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class TopicPickerPageObject extends PageObject {
  verifyIsShown = (): Promise<TopicPickerPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(topicPickerTestIds.root);
      return this;
    });

  verifyIsNotShown = () =>
    this.step("verifyIsNotShown", () => this.expectNotToBeVisible(topicPickerTestIds.root));

  search = (query: string) =>
    this.step(`search ${query}`, () => this.get(topicPickerTestIds.searchInput).fill(query));

  verifyOffers = (names: string[]) =>
    this.step(`verifyOffers ${names.join(", ")}`, () =>
      expect(this.page.getByTestId(/^TopicPicker\.option\./)).toHaveText(
        names.map((name) => new RegExp(name)),
      ),
    );

  verifyOfferedCounts = (counts: string[]) =>
    this.step(`verifyOfferedCounts ${counts.join(", ")}`, () =>
      expect(this.get(topicPickerTestIds.optionCount)).toHaveText(counts),
    );

  verifyOffersToCreate = (name: string) =>
    this.step(`verifyOffersToCreate ${name}`, () =>
      expect(this.get(topicPickerTestIds.createOption)).toContainText(name),
    );

  verifyOffersNoCreate = () =>
    this.step("verifyOffersNoCreate", () => this.expectNotToBeVisible(topicPickerTestIds.createOption));

  clickCreate = () => this.step("clickCreate", () => this.click(topicPickerTestIds.createOption));

  clickTopic = (name: string) =>
    this.step(`clickTopic ${name}`, () => this.click(topicPickerTestIds.option(name)));

  verifyTopicIsPicked = (name: string, picked: boolean) =>
    this.step(`verifyTopicIsPicked ${name} ${picked}`, () =>
      expect(this.get(topicPickerTestIds.option(name))).toHaveAttribute("aria-pressed", String(picked)),
    );

  // Measured once the entrance has settled: the sheet travels its own height, so reading it
  // mid-flight reports wherever it had got to.
  verifyRestsOnTheWindowFoot = () =>
    this.step("verifyRestsOnTheWindowFoot", () =>
      expect(async () => {
        const sheet = (await this.get(topicPickerTestIds.root).boundingBox())!;
        const window = this.page.viewportSize()!;
        expect(Math.round(sheet.x)).toBe(0);
        expect(Math.round(sheet.width)).toBe(window.width);
        expect(Math.round(sheet.y + sheet.height)).toBe(window.height);
      }).toPass({ timeout: 2_000 }),
    );

  clickDone = () => this.step("clickDone", () => this.click(topicPickerTestIds.doneButton));

  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));
}
