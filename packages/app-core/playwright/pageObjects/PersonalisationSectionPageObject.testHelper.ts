import { expect } from "@playwright/experimental-ct-react";
import type { SectionsEnabled } from "@overview/domain";
import { personalisationSectionTestIds } from "../../src/features/settings/components/PersonalisationSection/PersonalisationSectionTestIds.js";
import { whatWeKnowCardTestIds } from "../../src/features/settings/components/WhatWeKnowCard/WhatWeKnowCardTestIds.js";
import { AboutYouSentencePageObject } from "./AboutYouSentencePageObject.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";

export class PersonalisationSectionPageObject extends PageObject {
  verifySwitchIs = (name: string, on: boolean) =>
    this.step(`verifySwitchIs ${name} ${on}`, () =>
      expect(this.page.getByRole("switch", { name })).toHaveAttribute("aria-checked", String(on)),
    );

  get sentence() {
    return new AboutYouSentencePageObject(this.testContext);
  }

  verifyAboutYouReads = (text: string) =>
    this.step(`verifyAboutYouReads ${text}`, () => expect(this.page.getByTestId(whatWeKnowCardTestIds.sentence)).toHaveText(text));

  verifyAboutYouIsNotSet = () =>
    this.step("verifyAboutYouIsNotSet", () => expect(this.page.getByTestId(whatWeKnowCardTestIds.empty)).toBeVisible());

  openAboutYou = () => this.step("openAboutYou", () => this.page.getByTestId(whatWeKnowCardTestIds.open).click());

  closeAboutYou = () => this.step("closeAboutYou", () => this.page.getByTestId(whatWeKnowCardTestIds.done).click());

  clearAboutYou = () =>
    this.step("clearAboutYou", async () => {
      await this.openAboutYou();
      await this.page.getByTestId(whatWeKnowCardTestIds.clear).click();
    });

  clickSwitch = (section: keyof SectionsEnabled) =>
    this.step(`clickSwitch ${section}`, () => this.click(personalisationSectionTestIds.switch(section)));
}
