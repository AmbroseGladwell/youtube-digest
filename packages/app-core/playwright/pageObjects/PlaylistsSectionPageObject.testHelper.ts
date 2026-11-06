import { expect } from "@playwright/experimental-ct-react";
import { followedPlaylistRowTestIds } from "../../src/features/playlists/components/FollowedPlaylistRow/FollowedPlaylistRowTestIds.js";
import { playlistsSectionTestIds } from "../../src/features/playlists/components/PlaylistsSection/PlaylistsSectionTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { PlaylistFollowFlowPageObject } from "./PlaylistFollowFlowPageObject.testHelper.js";

// Settings › YouTube playlists (designs 27p–27s).
export class PlaylistsSectionPageObject extends PageObject {
  get flow(): PlaylistFollowFlowPageObject {
    return new PlaylistFollowFlowPageObject(this.testContext);
  }

  verifyEmpty = () => this.step("verifyEmpty", () => this.expectToBeVisible(playlistsSectionTestIds.empty));

  verifyFollowing = (titles: string[]) =>
    this.step(`verifyFollowing ${titles.join(", ")}`, async () => {
      await expect(this.get(playlistsSectionTestIds.followedLabel)).toHaveText(`Following ${titles.length}`);
      await expect(this.get(followedPlaylistRowTestIds.title)).toHaveText(titles);
    });

  verifyMeta = (index: number, meta: string) =>
    this.step(`verifyMeta ${index} ${meta}`, () => expect(this.get(followedPlaylistRowTestIds.meta).nth(index)).toHaveText(meta));

  verifyUnavailable = (text: string) =>
    this.step(`verifyUnavailable ${text}`, () => expect(this.get(followedPlaylistRowTestIds.unavailable)).toHaveText(text));

  lookUp = (url: string) =>
    this.step(`lookUp ${url}`, async () => {
      await this.get(playlistsSectionTestIds.linkInput).fill(url);
      await this.click(playlistsSectionTestIds.lookUpButton);
    });

  verifyLinkError = (text: string) =>
    this.step(`verifyLinkError ${text}`, () => expect(this.get(playlistsSectionTestIds.linkError)).toHaveText(text));

  unfollow = (title: string, confirmText: string) =>
    this.step(`unfollow ${title}`, async () => {
      await this.page.getByRole("button", { name: `Unfollow ${title}` }).click();
      await expect(this.get(followedPlaylistRowTestIds.confirm)).toContainText(confirmText);
      await this.click(followedPlaylistRowTestIds.confirmUnfollowButton);
    });

  verifyFacts = (index: number, facts: string) =>
    this.step(`verifyFacts ${index} ${facts}`, () => expect(this.get(followedPlaylistRowTestIds.facts).nth(index)).toHaveText(facts));

  // Opens the playlist's pace menu, checks what an option says it would do, and chooses it.
  choosePace = (title: string, pace: string, detail?: string) => this.choose("Pace", title, pace, detail);

  chooseOrder = (title: string, order: string, detail?: string) => this.choose("Order", title, order, detail);

  private choose = (title: string, subject: string, option: string, detail?: string) =>
    this.step(`choose ${title} ${subject} ${option}`, async () => {
      await this.page.getByRole("button", { name: new RegExp(`^${title} for ${subject}: `) }).click();
      const chosen = this.page
        .getByRole("menu", { name: `${title} for ${subject}` })
        .getByRole("menuitemradio", { name: new RegExp(`^${option}`) });
      if (detail !== undefined) await expect(chosen).toContainText(detail);
      await chosen.click();
    });

  verifySaid = (text: string) =>
    this.step(`verifySaid ${text}`, () => expect(this.get(followedPlaylistRowTestIds.said).filter({ hasText: text })).toHaveCount(1));

  verifyNoChoicesFor = (title: string) =>
    this.step(`verifyNoChoicesFor ${title}`, async () => {
      await expect(this.page.getByRole("button", { name: new RegExp(`^Pace for ${title}: `) })).toHaveCount(0);
      await expect(this.page.getByRole("button", { name: new RegExp(`^Order for ${title}: `) })).toHaveCount(0);
    });
}
