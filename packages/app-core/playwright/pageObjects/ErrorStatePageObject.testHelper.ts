import { expect } from "@playwright/test";
import { errorStateTestIds } from "../../src/components/shared/ErrorState/ErrorStateTestIds.js";
import { unreadableOverviewTestIds } from "../../src/features/reader/components/UnreadableOverview/UnreadableOverviewTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class ErrorStatePageObject extends PageObject {
  verifyIsShown = (): Promise<ErrorStatePageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(errorStateTestIds.root);
      return this;
    });

  verifyTitleReads = (title: string): Promise<void> =>
    this.step(`verifyTitleReads ${title}`, () =>
      expect(this.get(errorStateTestIds.title)).toHaveText(title),
    );

  verifyOffersAction = (label: string): Promise<void> =>
    this.step(`verifyOffersAction ${label}`, () =>
      expect(this.get(errorStateTestIds.action)).toHaveText(label),
    );

  verifyOffersNoAction = (): Promise<void> =>
    this.step("verifyOffersNoAction", () => this.expectToHaveCount(errorStateTestIds.action, 0));

  verifyOffersWayBack = (): Promise<void> =>
    this.step("verifyOffersWayBack", () => this.expectToBeVisible(errorStateTestIds.back));

  verifyOffersNoWayBack = (): Promise<void> =>
    this.step("verifyOffersNoWayBack", () => this.expectToHaveCount(errorStateTestIds.back, 0));

  verifyHoldsFocus = (): Promise<void> =>
    this.step("verifyHoldsFocus", () => expect(this.get(errorStateTestIds.root)).toBeFocused());

  verifyWayOutIsOneTabAway = (): Promise<void> =>
    this.step("verifyWayOutIsOneTabAway", async () => {
      await this.page.keyboard.press("Tab");
      await expect(this.get(errorStateTestIds.action)).toBeFocused();
    });

  verifyOffersGenerateAgain = (): Promise<void> =>
    this.step("verifyOffersGenerateAgain", () =>
      this.expectToBeVisible(unreadableOverviewTestIds.generateAgain),
    );

  verifyOffersNoGenerateAgain = (): Promise<void> =>
    this.step("verifyOffersNoGenerateAgain", () =>
      this.expectToHaveCount(unreadableOverviewTestIds.generateAgain, 0),
    );

  verifyHasNoBody = (): Promise<void> =>
    this.step("verifyHasNoBody", () => this.expectToHaveCount(errorStateTestIds.body, 0));

  verifyIsGone = (): Promise<void> =>
    this.step("verifyIsGone", () => this.expectToHaveCount(errorStateTestIds.root, 0));

  takeAction = (): Promise<void> => this.step("takeAction", () => this.click(errorStateTestIds.action));
}
