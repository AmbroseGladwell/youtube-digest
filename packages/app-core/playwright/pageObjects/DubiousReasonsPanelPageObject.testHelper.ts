import { expect } from "@playwright/experimental-ct-react";
import { dubiousReasonsPanelTestIds } from "../../src/features/reader/components/DubiousReasonsPanel/DubiousReasonsPanelTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class DubiousReasonsPanelPageObject extends PageObject {
  verifyIsShown = (): Promise<DubiousReasonsPanelPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(dubiousReasonsPanelTestIds.root);
      return this;
    });

  verifyIsNotShown = () =>
    this.step("verifyIsNotShown", () => this.expectNotToBeVisible(dubiousReasonsPanelTestIds.root));

  verifyFocusIsOnHeading = () =>
    this.step("verifyFocusIsOnHeading", () => expect(this.get(dubiousReasonsPanelTestIds.heading)).toBeFocused());

  verifyCountReads = (count: string) =>
    this.step(`verifyCountReads ${count}`, () => expect(this.get(dubiousReasonsPanelTestIds.count)).toHaveText(count));

  verifyShowsNoCount = () =>
    this.step("verifyShowsNoCount", () => this.expectNotToBeVisible(dubiousReasonsPanelTestIds.count));

  verifyClaimsRead = (claims: string[]) =>
    this.step(`verifyClaimsRead ${claims.join(" | ")}`, () =>
      expect(this.get(dubiousReasonsPanelTestIds.claim)).toHaveText(claims.map((claim) => `“${claim}”`)),
    );

  verifyBasesRead = (bases: string[]) =>
    this.step(`verifyBasesRead ${bases.join(" | ")}`, () =>
      expect(this.get(dubiousReasonsPanelTestIds.basis)).toHaveText(bases),
    );

  verifyReasonsMention = (reasons: string[]) =>
    this.step(`verifyReasonsMention ${reasons.join(" | ")}`, async () => {
      const items = this.get(dubiousReasonsPanelTestIds.reason);
      await expect(items).toHaveCount(reasons.length);
      for (const [index, reason] of reasons.entries()) {
        await expect(items.nth(index)).toContainText(reason);
      }
    });

  verifyOffersToWatchFrom = (labels: { label: string; url: string }[]) =>
    this.step(`verifyOffersToWatchFrom ${labels.map(({ label }) => label).join(" | ")}`, async () => {
      const links = this.get(dubiousReasonsPanelTestIds.watchLink);
      await expect(links).toHaveCount(labels.length);
      for (const [index, { label, url }] of labels.entries()) {
        const link = links.nth(index);
        await expect(link).toHaveText(label);
        await expect(link).toHaveAttribute("href", url);
        await expect(link).toHaveAttribute("target", "_blank");
      }
    });

  verifySaysNoReasonWasSaved = () =>
    this.step("verifySaysNoReasonWasSaved", async () => {
      await expect(this.get(dubiousReasonsPanelTestIds.noReasonSaved)).toContainText("No reason was saved");
      await this.expectNotToBeVisible(dubiousReasonsPanelTestIds.reason);
      await this.expectToBeVisible(dubiousReasonsPanelTestIds.looksWrongButton);
    });

  clickSkipTo = (index: number) =>
    this.step(`clickSkipTo ${index}`, () => this.get(dubiousReasonsPanelTestIds.skipButton).nth(index).click());

  clickThisLooksWrong = () =>
    this.step("clickThisLooksWrong", async () => {
      await this.click(dubiousReasonsPanelTestIds.looksWrongButton);
      await expect(this.get(dubiousReasonsPanelTestIds.looksWrongThanks)).toHaveText("Thanks, noted.");
      await this.expectNotToBeVisible(dubiousReasonsPanelTestIds.looksWrongButton);
    });

  clickClose = () => this.step("clickClose", () => this.click(dubiousReasonsPanelTestIds.closeButton));

  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));
}
