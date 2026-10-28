import { expect } from "@playwright/experimental-ct-react";
import type { SectionsEnabled } from "@overview/domain";
import { aboutYouCardTestIds } from "../../src/features/settings/components/AboutYouCard/AboutYouCardTestIds.js";
import { personalisationSectionTestIds } from "../../src/features/settings/components/PersonalisationSection/PersonalisationSectionTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class PersonalisationSectionPageObject extends PageObject {
  verifySwitchIs = (name: string, on: boolean) =>
    this.step(`verifySwitchIs ${name} ${on}`, () =>
      expect(this.page.getByRole("switch", { name })).toHaveAttribute("aria-checked", String(on)),
    );

  verifyAboutYouReads = (text: string) =>
    this.step(`verifyAboutYouReads ${text}`, () => expect(this.page.getByTestId(aboutYouCardTestIds.value)).toHaveText(text));

  setAboutYou = ({ role, goals = [] }: { role: string; goals?: string[] }) =>
    this.step(`setAboutYou ${role}`, async () => {
      await this.page.getByTestId(aboutYouCardTestIds.open).click();
      await this.page.getByTestId(aboutYouCardTestIds.role(role)).click();
      for (const goal of goals) await this.page.getByTestId(aboutYouCardTestIds.goal(goal)).click();
      await this.page.getByTestId(aboutYouCardTestIds.done).click();
    });

  clearAboutYou = () =>
    this.step("clearAboutYou", async () => {
      await this.page.getByTestId(aboutYouCardTestIds.open).click();
      await this.page.getByTestId(aboutYouCardTestIds.clear).click();
    });

  clickSwitch = (section: keyof SectionsEnabled) =>
    this.step(`clickSwitch ${section}`, () => this.click(personalisationSectionTestIds.switch(section)));
}
