import { expect } from "@playwright/experimental-ct-react";
import { playlistFollowFlowTestIds } from "../../src/features/playlists/components/PlaylistFollowFlow/PlaylistFollowFlowTestIds.js";
import { playlistPreviewTestIds } from "../../src/features/playlists/components/PlaylistPreview/PlaylistPreviewTestIds.js";
import { playlistRefusalTestIds } from "../../src/features/playlists/components/PlaylistRefusal/PlaylistRefusalTestIds.js";
import { previewChoiceLineTestIds } from "../../src/features/playlists/components/PreviewChoiceLine/PreviewChoiceLineTestIds.js";
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

  verifyPace = (name: string, result: string) => this.verifyChoice("pace", name, result);

  verifyOrder = (name: string, result: string) => this.verifyChoice("order", name, result);

  private verifyChoice = (choice: string, name: string, result: string) =>
    this.step(`verify ${choice} ${name}`, async () => {
      await expect(this.get(previewChoiceLineTestIds.name(choice))).toHaveText(name);
      await expect(this.get(previewChoiceLineTestIds.result(choice))).toHaveText(result);
    });

  // What the month's allowance means for the backfill, before anything runs (95s, 95v).
  verifyAllowance = (text: string | null) =>
    this.step(`verifyAllowance ${text}`, () =>
      text === null
        ? this.expectToHaveCount(playlistPreviewTestIds.allowance, 0)
        : expect(this.get(playlistPreviewTestIds.allowance)).toHaveText(text),
    );

  verifyNoPace = () =>
    this.step("verifyNoPace", async () => {
      await this.expectToHaveCount(previewChoiceLineTestIds.line("pace"), 0);
      await this.expectToHaveCount(previewChoiceLineTestIds.line("order"), 0);
    });

  // Change opens the choices in place, each with what it would do; choosing is immediate.
  changePace = (pace: string, result: string) => this.changeChoice("pace", "Pace", pace, result);

  changeOrder = (order: string, result: string) => this.changeChoice("order", "Order", order, result);

  private changeChoice = (choice: string, title: string, option: string, result: string) =>
    this.step(`change ${choice} ${option}`, async () => {
      await this.click(previewChoiceLineTestIds.changeButton(choice));
      const group = this.page.getByRole("radiogroup", { name: new RegExp(`^${title} for `) });
      await expect(group).toContainText(result);
      await group.getByRole("radio", { name: new RegExp(`^${option}`) }).check();
    });

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
