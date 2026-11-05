import { expect } from "@playwright/experimental-ct-react";
import { panelStartTestIds } from "../../src/features/onboarding/components/PanelStart/PanelStartTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class PanelStartPageObject extends PageObject {
  verifyIsShown = (): Promise<PanelStartPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(panelStartTestIds.root);
      return this;
    });

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectNotToBeVisible(panelStartTestIds.root));

  verifyHeading = (heading: string) =>
    this.step(`verifyHeading ${heading}`, () =>
      expect(this.page.getByRole("heading", { level: 1, name: heading })).toBeFocused(),
    );

  verifyLeadReads = (lead: string) =>
    this.step(`verifyLeadReads ${lead}`, () => expect(this.get(panelStartTestIds.root).locator("p").first()).toHaveText(lead));

  verifyOffersBackToSignIn = () =>
    this.step("verifyOffersBackToSignIn", () => this.expectToBeVisible(panelStartTestIds.backToSignIn));

  backToSignIn = () => this.step("backToSignIn", () => this.click(panelStartTestIds.backToSignIn));

  verifyCantMakeWithoutAVideo = () =>
    this.step("verifyCantMakeWithoutAVideo", () => expect(this.get(panelStartTestIds.makeOverview)).toBeDisabled());

  makeOverview = () => this.step("makeOverview", () => this.click(panelStartTestIds.makeOverview));

  pasteLink = (link: string) =>
    this.step(`pasteLink ${link}`, async () => {
      if (await this.get(panelStartTestIds.pasteLink).isVisible()) await this.click(panelStartTestIds.pasteLink);
      await this.get(panelStartTestIds.linkField).fill(link);
      await this.click((await this.get(panelStartTestIds.linkSubmit).isVisible()) ? panelStartTestIds.linkSubmit : panelStartTestIds.makeOverview);
    });

  verifyRefused = () => this.step("verifyRefused", () => this.expectToBeVisible(panelStartTestIds.refused));

  signIn = () => this.step("signIn", () => this.click(panelStartTestIds.signIn));
}
