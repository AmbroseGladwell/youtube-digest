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

  verifyCantMakeWithoutAVideo = () =>
    this.step("verifyCantMakeWithoutAVideo", () => expect(this.get(panelStartTestIds.makeOverview)).toBeDisabled());

  makeOverview = () => this.step("makeOverview", () => this.click(panelStartTestIds.makeOverview));

  pasteLink = (link: string) =>
    this.step(`pasteLink ${link}`, async () => {
      if (await this.get(panelStartTestIds.pasteLink).isVisible()) await this.click(panelStartTestIds.pasteLink);
      await this.get(panelStartTestIds.linkField).fill(link);
      await this.click(panelStartTestIds.linkSubmit);
    });

  verifyRefused = () => this.step("verifyRefused", () => this.expectToBeVisible(panelStartTestIds.refused));

  signIn = () => this.step("signIn", () => this.click(panelStartTestIds.signIn));
}
