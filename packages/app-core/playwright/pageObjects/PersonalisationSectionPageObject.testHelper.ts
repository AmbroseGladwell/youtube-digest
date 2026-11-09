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

  verifyLearned = (...items: string[]) =>
    this.step(`verifyLearned ${items.join(", ")}`, async () => {
      for (const item of items) await expect(this.page.getByTestId(whatWeKnowCardTestIds.learnedItem(item))).toBeVisible();
    });

  verifyLearnedSource = (item: string, source: string) =>
    this.step(`verifyLearnedSource ${item}`, () => expect(this.page.getByTestId(whatWeKnowCardTestIds.learnedItem(item))).toContainText(source));

  verifyNothingLearned = () =>
    this.step("verifyNothingLearned", () => expect(this.page.getByTestId(whatWeKnowCardTestIds.learnedEmpty)).toBeVisible());

  verifyMetaReads = (text: string) =>
    this.step(`verifyMetaReads ${text}`, () => expect(this.page.getByTestId(whatWeKnowCardTestIds.meta)).toHaveText(text));

  removeLearned = (item: string) =>
    this.step(`removeLearned ${item}`, () => this.page.getByTestId(whatWeKnowCardTestIds.learnedRemove(item)).click());

  switchKeepLearning = () => this.step("switchKeepLearning", () => this.page.getByTestId(whatWeKnowCardTestIds.keepLearning).click());

  switchShareWithAssistants = () =>
    this.step("switchShareWithAssistants", () => this.page.getByTestId(whatWeKnowCardTestIds.shareWithAssistants).click());

  verifyCantShareWithAssistants = () =>
    this.step("verifyCantShareWithAssistants", () => expect(this.page.getByTestId(whatWeKnowCardTestIds.shareWithAssistants)).toHaveCount(0));

  verifyCantSwitchLearning = () =>
    this.step("verifyCantSwitchLearning", () => expect(this.page.getByTestId(whatWeKnowCardTestIds.keepLearning)).toHaveCount(0));

  verifyLearningIsHidden = () =>
    this.step("verifyLearningIsHidden", async () => {
      await expect(this.page.getByTestId(whatWeKnowCardTestIds.keepLearning)).toHaveCount(0);
      await expect(this.page.getByTestId(whatWeKnowCardTestIds.learnedEmpty)).toHaveCount(0);
    });

  clickSwitch = (section: keyof SectionsEnabled) =>
    this.step(`clickSwitch ${section}`, () => this.click(personalisationSectionTestIds.switch(section)));
}
