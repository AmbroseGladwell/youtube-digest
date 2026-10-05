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
}
