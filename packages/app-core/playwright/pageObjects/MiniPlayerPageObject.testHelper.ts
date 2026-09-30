import { expect } from "@playwright/experimental-ct-react";
import { miniPlayerTestIds } from "../../src/features/player/components/MiniPlayer/MiniPlayerTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { ReaderPageObject } from "./ReaderPageObject.testHelper.js";

export class MiniPlayerPageObject extends PageObject {
  verifyIsShown = (shown: boolean) =>
    this.step(`verifyIsShown ${shown}`, () =>
      shown ? this.expectToBeVisible(miniPlayerTestIds.root) : this.expectNotToBeVisible(miniPlayerTestIds.root),
    );

  verifyTitleReads = (title: string) =>
    this.step(`verifyTitleReads ${title}`, () =>
      expect(this.get(miniPlayerTestIds.titleLink)).toContainText(title),
    );

  verifyPlayButtonReads = (label: string) =>
    this.step(`verifyPlayButtonReads ${label}`, () =>
      expect(this.get(miniPlayerTestIds.playButton)).toHaveAttribute("aria-label", label),
    );

  clickPlayPause = () => this.step("clickPlayPause", () => this.click(miniPlayerTestIds.playButton));

  clickClose = () => this.step("clickClose", () => this.click(miniPlayerTestIds.closeButton));

  openReader = (): Promise<ReaderPageObject> =>
    this.step("openReader", async () => {
      await this.click(miniPlayerTestIds.titleLink);
      return new ReaderPageObject(this.testContext).verifyIsShown();
    });
}
