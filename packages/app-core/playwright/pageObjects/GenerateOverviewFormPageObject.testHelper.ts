import { expect } from "@playwright/experimental-ct-react";
import { generateOverviewFormTestIds } from "../../src/features/newOverview/components/GenerateOverviewForm/GenerateOverviewFormTestIds.js";
import { playlistLinkChoiceTestIds } from "../../src/features/playlists/components/PlaylistLinkChoice/PlaylistLinkChoiceTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class GenerateOverviewFormPageObject extends PageObject {
  verifyIsShown = (): Promise<GenerateOverviewFormPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(generateOverviewFormTestIds.root);
      return this;
    });

  verifyIsHidden = () =>
    this.step("verifyIsHidden", () => expect(this.get(generateOverviewFormTestIds.urlInput)).toBeHidden());

  verifyUrlInputVisible = () =>
    this.step("verifyUrlInputVisible", () => this.expectToBeVisible(generateOverviewFormTestIds.urlInput));

  fillUrl = (url: string) =>
    this.step(`fillUrl ${url}`, () => this.get(generateOverviewFormTestIds.urlInput).fill(url));

  // A paste, rather than typing, which is what the field checks a link on.
  pasteUrl = (url: string) =>
    this.step(`pasteUrl ${url}`, async () => {
      const input = this.get(generateOverviewFormTestIds.urlInput);
      await input.focus();
      await input.evaluate((element, text) => {
        const data = new DataTransfer();
        data.setData("text", text);
        element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
      }, url);
    });

  verifyOffersVideoOrPlaylist = (playlistDetail: string) =>
    this.step(`verifyOffersVideoOrPlaylist ${playlistDetail}`, async () => {
      await this.expectToBeVisible(playlistLinkChoiceTestIds.root);
      await expect(this.get(playlistLinkChoiceTestIds.playlistButton)).toContainText(playlistDetail);
      await this.expectToHaveCount(generateOverviewFormTestIds.generateButton, 0);
    });

  chooseJustThisVideo = () => this.step("chooseJustThisVideo", () => this.click(playlistLinkChoiceTestIds.videoButton));

  chooseWholePlaylist = () => this.step("chooseWholePlaylist", () => this.click(playlistLinkChoiceTestIds.playlistButton));

  clickGenerate = () => this.step("clickGenerate", () => this.click(generateOverviewFormTestIds.generateButton));

  verifyUrlInputHolds = (url: string) =>
    this.step(`verifyUrlInputHolds ${url}`, () =>
      expect(this.get(generateOverviewFormTestIds.urlInput)).toHaveValue(url),
    );

  submitUrl = (url: string) =>
    this.step(`submitUrl ${url}`, async () => {
      await this.fillUrl(url);
      await this.clickGenerate();
    });

  verifyValidationError = (message: string) =>
    this.step(`verifyValidationError ${message}`, () =>
      expect(this.get(generateOverviewFormTestIds.validationError)).toHaveText(message),
    );

  verifyGenerationError = (message: string | RegExp) =>
    this.step(`verifyGenerationError ${String(message)}`, () =>
      expect(this.get(generateOverviewFormTestIds.generationError)).toHaveText(message),
    );

  clickCancel = () => this.step("clickCancel", () => this.click(generateOverviewFormTestIds.cancelButton));

  verifyGenerationErrorIsVisible = () =>
    this.step("verifyGenerationErrorIsVisible", () => this.expectToBeVisible(generateOverviewFormTestIds.generationError));

  verifyGenerateButtonEnabled = () =>
    this.step("verifyGenerateButtonEnabled", () =>
      expect(this.get(generateOverviewFormTestIds.generateButton)).toBeEnabled(),
    );

  verifyUrlInputDisabled = () =>
    this.step("verifyUrlInputDisabled", () => expect(this.get(generateOverviewFormTestIds.urlInput)).toBeDisabled());

  clickUseWatchedVideo = () =>
    this.step("clickUseWatchedVideo", () => this.click(generateOverviewFormTestIds.watchingButton));

  verifyOffersWatchedVideo = () =>
    this.step("verifyOffersWatchedVideo", () => this.expectToBeVisible(generateOverviewFormTestIds.watchingButton));

  verifySaysUrlCameFromWatchedVideo = () =>
    this.step("verifySaysUrlCameFromWatchedVideo", () =>
      this.expectToBeVisible(generateOverviewFormTestIds.watchingNote),
    );

  verifyWatchedVideoNote = (pattern: RegExp) =>
    this.step(`verifyWatchedVideoNote ${pattern.source}`, () =>
      expect(this.get(generateOverviewFormTestIds.watchingNote)).toHaveText(pattern),
    );

  verifySaysNothingAboutAWatchedVideo = () =>
    this.step("verifySaysNothingAboutAWatchedVideo", async () => {
      await this.expectToHaveCount(generateOverviewFormTestIds.watchingButton, 0);
      await this.expectToHaveCount(generateOverviewFormTestIds.watchingNote, 0);
    });

  // Signed out past the trial's 3, the form offers an account where Generate would be,
  // whatever keys the device holds (docs/architecture/tiers.md, "At the limit").
  verifyOffersAccountForTrial = () =>
    this.step("verifyOffersAccountForTrial", () =>
      this.verifyLimitMessage({
        title: "You've used your 3 trial overviews",
        actions: ["Create account"],
      }),
    );

  clickCreateAccountForTrial = () => this.clickLimitAction("createAccount");

  // What's left of the quota the next overview will use (design 95b).
  verifyUsageLineReads = (text: string) =>
    this.step(`verifyUsageLineReads ${text}`, () => expect(this.get(generateOverviewFormTestIds.usageLine.root)).toHaveText(text));

  verifyHasNoUsageLine = () =>
    this.step("verifyHasNoUsageLine", () => this.expectToHaveCount(generateOverviewFormTestIds.usageLine.root, 0));

  clickUsagePlanLink = () =>
    this.step("clickUsagePlanLink", () => this.click(generateOverviewFormTestIds.usageLine.planLink));

  // What ran out, in Generate's place, with only the ways round it (designs 95i–95o).
  verifyLimitMessage = ({ title, body, actions }: { title: string; body?: string; actions: string[] }) =>
    this.step(`verifyLimitMessage ${title}`, async () => {
      const ids = generateOverviewFormTestIds.limitMessage;
      await expect(this.get(ids.title)).toHaveText(title);
      if (body !== undefined) await expect(this.get(ids.body)).toHaveText(body);
      await expect(this.get(ids.root).getByRole("link")).toHaveText(actions);
      await expect(this.get(ids.foot)).toHaveText("Everything you've already made keeps working.");
      await this.expectToHaveCount(generateOverviewFormTestIds.generateButton, 0);
      await this.expectToHaveCount(generateOverviewFormTestIds.usageLine.root, 0);
    });

  verifyLimitActionIsFocused = (action: string) =>
    this.step(`verifyLimitActionIsFocused ${action}`, () =>
      expect(this.get(generateOverviewFormTestIds.limitMessage.action(action))).toBeFocused(),
    );

  clickLimitAction = (action: string) =>
    this.step(`clickLimitAction ${action}`, () => this.click(generateOverviewFormTestIds.limitMessage.action(action)));

  clickSettingsLink = () =>
    this.step("clickSettingsLink", () => this.click(generateOverviewFormTestIds.keyPrompt.settingsLink));
}
