import { expect } from "@playwright/experimental-ct-react";
import { episodePlayerTestIds } from "../../src/features/reader/components/EpisodePlayer/EpisodePlayerTestIds.js";
import { JUMP_LINE } from "../../src/features/reader/episode/jumpLine.js";
import { PageObject } from "./PageObject.testHelper.js";

// An episode's own player under its note's head (design 106p).
export class EpisodePlayerPageObject extends PageObject {
  verifyIsShown = () =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(episodePlayerTestIds.root);
      await expect(this.get(episodePlayerTestIds.root)).toContainText("Episode audio");
      return this;
    });

  verifyLength = (length: string) =>
    this.step(`verifyLength ${length}`, () => expect(this.get(episodePlayerTestIds.length)).toHaveText(length));

  verifyPlaying = (playing: boolean) =>
    this.step(`verifyPlaying ${playing}`, () =>
      expect(this.get(episodePlayerTestIds.playButton)).toHaveAttribute("aria-label", playing ? "Pause the episode" : "Play the episode"),
    );

  verifyJumpLineShown = (shown: boolean) =>
    this.step(`verifyJumpLineShown ${shown}`, async () => {
      const line = this.get(episodePlayerTestIds.jumpLine);
      await expect(line).toHaveText(JUMP_LINE);
      await expect(line).toHaveCSS("opacity", shown ? "1" : "0");
    });

  clickPlay = () => this.step("clickPlay", () => this.click(episodePlayerTestIds.playButton));

  clickForward = () => this.step("clickForward", () => this.click(episodePlayerTestIds.forwardButton));
}
