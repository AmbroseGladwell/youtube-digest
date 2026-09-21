import { expect } from "@playwright/test";
import { errorStateTestIds } from "../../src/components/shared/ErrorState/ErrorStateTestIds.js";
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

  verifyActionHasFocus = (): Promise<void> =>
    this.step("verifyActionHasFocus", () => expect(this.get(errorStateTestIds.action)).toBeFocused());

  verifyWayBackHasFocus = (): Promise<void> =>
    this.step("verifyWayBackHasFocus", () => expect(this.get(errorStateTestIds.back)).toBeFocused());

  verifyHasNoBody = (): Promise<void> =>
    this.step("verifyHasNoBody", () => this.expectToHaveCount(errorStateTestIds.body, 0));

  verifyIsGone = (): Promise<void> =>
    this.step("verifyIsGone", () => this.expectToHaveCount(errorStateTestIds.root, 0));

  takeAction = (): Promise<void> => this.step("takeAction", () => this.click(errorStateTestIds.action));
}
