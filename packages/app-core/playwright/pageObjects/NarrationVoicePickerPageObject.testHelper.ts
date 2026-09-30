import { expect } from "@playwright/experimental-ct-react";
import { NarrationVoice } from "@overview/domain";
import { narrationVoicePickerTestIds } from "../../src/features/settings/components/NarrationVoicePicker/NarrationVoicePickerTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class NarrationVoicePickerPageObject extends PageObject {
  verifyIsShown = (): Promise<NarrationVoicePickerPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(narrationVoicePickerTestIds.root);
      return this;
    });

  verifyIsAbsent = () =>
    this.step("verifyIsAbsent", () => this.expectToHaveCount(narrationVoicePickerTestIds.root, 0));

  chooseVoice = (voice: NarrationVoice) =>
    this.step(`chooseVoice ${voice}`, () => this.get(narrationVoicePickerTestIds.radio(voice)).check());

  verifyChosen = (voice: NarrationVoice) =>
    this.step(`verifyChosen ${voice}`, async () => {
      await expect(this.get(narrationVoicePickerTestIds.radio(voice))).toBeChecked();
      await expect(this.get(narrationVoicePickerTestIds.row(voice))).toHaveAttribute("data-chosen", "true");
    });

  verifyChosenRowIsInView = (voice: NarrationVoice) =>
    this.step(`verifyChosenRowIsInView ${voice}`, () =>
      expect(this.get(narrationVoicePickerTestIds.row(voice))).toBeInViewport(),
    );

  verifyStatusSays = (text: string | RegExp) =>
    this.step(`verifyStatusSays ${String(text)}`, () =>
      expect(this.get(narrationVoicePickerTestIds.status)).toHaveText(text),
    );

  verifyRowSecondLineReads = (voice: NarrationVoice, text: string | RegExp) =>
    this.step(`verifyRowSecondLineReads ${voice} ${String(text)}`, () =>
      expect(this.get(narrationVoicePickerTestIds.second(voice))).toHaveText(text, { timeout: 10_000 }),
    );

  playSample = (voice: NarrationVoice) =>
    this.step(`playSample ${voice}`, () => this.click(narrationVoicePickerTestIds.play(voice)));

  stopSample = (voice: NarrationVoice) =>
    this.step(`stopSample ${voice}`, () => this.click(narrationVoicePickerTestIds.stop(voice)));

  verifyPlayButtonName = (voice: NarrationVoice, name: string) =>
    this.step(`verifyPlayButtonName ${voice}`, () =>
      expect(this.get(narrationVoicePickerTestIds.play(voice))).toHaveAccessibleName(name),
    );

  verifySampleIsPlaying = (voice: NarrationVoice, playing: boolean) =>
    this.step(`verifySampleIsPlaying ${voice} ${playing}`, async () => {
      if (playing) {
        await this.expectToBeVisible(narrationVoicePickerTestIds.stop(voice));
      } else {
        await this.expectToHaveCount(narrationVoicePickerTestIds.stop(voice), 0);
      }
    });

  verifyOffersSamples = (offered: boolean) =>
    this.step(`verifyOffersSamples ${offered}`, async () => {
      if (offered) {
        await expect(this.page.getByTestId(/^NarrationVoicePicker\.play\./)).toHaveCount(NarrationVoice.options.length);
      } else {
        await expect(this.page.getByTestId(/^NarrationVoicePicker\.play\./)).toHaveCount(0);
      }
    });

  verifySamplesDidNotLoad = () =>
    this.step("verifySamplesDidNotLoad", () =>
      this.expectToBeVisible(narrationVoicePickerTestIds.samplesUnavailable),
    );

  clickTryAgain = () => this.step("clickTryAgain", () => this.click(narrationVoicePickerTestIds.tryAgain));
}
