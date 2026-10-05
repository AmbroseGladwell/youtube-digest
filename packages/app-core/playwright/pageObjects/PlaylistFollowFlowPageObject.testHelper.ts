import { expect } from "@playwright/experimental-ct-react";
import { playlistFollowFlowTestIds } from "../../src/features/playlists/components/PlaylistFollowFlow/PlaylistFollowFlowTestIds.js";
import { playlistPreviewTestIds } from "../../src/features/playlists/components/PlaylistPreview/PlaylistPreviewTestIds.js";
import { playlistRefusalTestIds } from "../../src/features/playlists/components/PlaylistRefusal/PlaylistRefusalTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export interface ExpectedPreview {
  title: string;
  owner: string;
  facts: string[];
  estimate?: string;
  basis?: string;
}

// A pasted playlist from lookup to following, wherever it was pasted (docs/features/playlists.md).
export class PlaylistFollowFlowPageObject extends PageObject {
  verifyLookingUp = () => this.step("verifyLookingUp", () => this.expectToBeVisible(playlistFollowFlowTestIds.lookingUp));

  verifyPreview = (expected: ExpectedPreview) =>
    this.step(`verifyPreview ${expected.title}`, async () => {
      await expect(this.get(playlistPreviewTestIds.title)).toHaveText(expected.title);
      await expect(this.get(playlistPreviewTestIds.owner)).toHaveText(expected.owner);
      await expect(this.get(playlistPreviewTestIds.facts).locator("li")).toHaveText(expected.facts);
      if (expected.estimate === undefined) {
        await this.expectToHaveCount(playlistPreviewTestIds.estimate, 0);
      } else {
        await expect(this.get(playlistPreviewTestIds.estimate)).toHaveText(expected.estimate);
        await expect(this.get(playlistPreviewTestIds.estimateBasis)).toHaveText(expected.basis!);
      }
    });

  verifyFirstActionIsFocused = () =>
    this.step("verifyFirstActionIsFocused", () =>
      expect(this.page.getByRole("group", { name: /^Follow / }).getByRole("button").first()).toBeFocused(),
    );

  verifyBackfillReads = (label: string) =>
    this.step(`verifyBackfillReads ${label}`, () => expect(this.get(playlistPreviewTestIds.backfillButton)).toHaveText(label));

  verifyNoBackfill = () => this.step("verifyNoBackfill", () => this.expectToHaveCount(playlistPreviewTestIds.backfillButton, 0));

  followWithBackfill = () => this.step("followWithBackfill", () => this.click(playlistPreviewTestIds.backfillButton));

  followNewOnly = () => this.step("followNewOnly", () => this.click(playlistPreviewTestIds.newOnlyButton));

  cancel = () => this.step("cancel", () => this.click(playlistPreviewTestIds.cancelButton));

  verifyRefusal = (title: string) =>
    this.step(`verifyRefusal ${title}`, () => expect(this.get(playlistRefusalTestIds.title)).toHaveText(title));

  verifyRefusalAction = (label: string | null) =>
    this.step(`verifyRefusalAction ${label}`, () =>
      label === null
        ? this.expectToHaveCount(playlistRefusalTestIds.actionButton, 0)
        : expect(this.get(playlistRefusalTestIds.actionButton)).toHaveText(label),
    );

  takeRefusalAction = () => this.step("takeRefusalAction", () => this.click(playlistRefusalTestIds.actionButton));

  pasteAnother = () => this.step("pasteAnother", () => this.click(playlistRefusalTestIds.pasteAnotherButton));
}
