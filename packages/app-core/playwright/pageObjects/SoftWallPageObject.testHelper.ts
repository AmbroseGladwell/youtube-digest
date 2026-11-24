import { expect } from "@playwright/experimental-ct-react";
import { softWallTestIds } from "../../src/features/newOverview/components/SoftWall/SoftWallTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class SoftWallPageObject extends PageObject {
  verifyIsShown = ({ resetsOn, link }: { resetsOn: string; link: { kicker: string | null; title: string } }) =>
    this.step("verifyIsShown", async () => {
      const wall = this.get(softWallTestIds.root);
      await expect(wall.getByRole("heading", { name: "You’ve hit your overview limit." })).toBeFocused();
      await expect(wall).toContainText(
        `Your overview limit resets on ${resetsOn}. Everything you’ve saved keeps working. Read, listen, search, and ask your AI.`,
      );
      await expect(this.get(softWallTestIds.link)).toHaveText(`The link you pasted${link.kicker ?? ""}${link.title}`);
      await this.expectToBeVisible(softWallTestIds.getPlus);
      await this.expectToBeVisible(softWallTestIds.seePlans);
    });

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectToHaveCount(softWallTestIds.root, 0));

  verifyOffersAKey = (offered: boolean) =>
    this.step(`verifyOffersAKey ${offered}`, () => this.expectToHaveCount(softWallTestIds.addKey, offered ? 1 : 0));

  addAKey = () => this.step("addAKey", () => this.click(softWallTestIds.addKey));

  getPlus = () => this.step("getPlus", () => this.click(softWallTestIds.getPlus));

  seeEveryPlan = () => this.step("seeEveryPlan", () => this.click(softWallTestIds.seePlans));

  verifyOffersSaving = (offered: boolean) =>
    this.step(`verifyOffersSaving ${offered}`, () => this.expectToHaveCount(softWallTestIds.saveForNow, offered ? 1 : 0));

  verifySavesLeftReads = (text: string | null) =>
    this.step(`verifySavesLeftReads ${text}`, async () => {
      if (text === null) {
        await this.expectToHaveCount(softWallTestIds.savesLeft, 0);
        return;
      }
      await expect(this.get(softWallTestIds.savesLeft)).toHaveText(text);
    });

  saveForNow = () => this.step("saveForNow", () => this.click(softWallTestIds.saveForNow));

  verifySaved = (title: string) =>
    this.step("verifySaved", async () => {
      const saved = this.get(softWallTestIds.saved);
      await expect(saved.getByRole("heading", { name: "Saved, with its transcript." })).toBeFocused();
      await expect(saved).toContainText(title);
      await expect(saved).toContainText("Saved · no overview yet");
    });

  savedDone = () => this.step("savedDone", () => this.click(softWallTestIds.savedDone));

  readTranscript = () => this.step("readTranscript", () => this.click(softWallTestIds.readTranscript));
}
