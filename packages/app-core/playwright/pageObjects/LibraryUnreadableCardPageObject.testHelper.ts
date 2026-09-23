import { expect } from "@playwright/test";
import { libraryUnreadableCardTestIds } from "../../src/features/library/components/LibraryUnreadableCard/LibraryUnreadableCardTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class LibraryUnreadableCardPageObject extends PageObject {
  verifyIsShown = (): Promise<LibraryUnreadableCardPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(libraryUnreadableCardTestIds.root);
      return this;
    });

  verifyTitleReads = (title: string): Promise<void> =>
    this.step(`verifyTitleReads ${title}`, () =>
      expect(this.get(libraryUnreadableCardTestIds.titleLink)).toHaveText(title),
    );

  verifyKickerReads = (kicker: string): Promise<void> =>
    this.step(`verifyKickerReads ${kicker}`, () =>
      expect(this.get(libraryUnreadableCardTestIds.kicker)).toHaveText(kicker),
    );

  open = (): Promise<void> =>
    this.step("open", () => this.click(libraryUnreadableCardTestIds.titleLink));
}
