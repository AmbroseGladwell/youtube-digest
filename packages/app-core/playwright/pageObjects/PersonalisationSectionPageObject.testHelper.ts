import { expect } from "@playwright/experimental-ct-react";
import type { SectionsEnabled } from "@overview/domain";
import { personalisationSectionTestIds } from "../../src/features/settings/components/PersonalisationSection/PersonalisationSectionTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class PersonalisationSectionPageObject extends PageObject {
  verifySwitchIs = (name: string, on: boolean) =>
    this.step(`verifySwitchIs ${name} ${on}`, () =>
      expect(this.page.getByRole("switch", { name })).toHaveAttribute("aria-checked", String(on)),
    );

  clickSwitch = (section: keyof SectionsEnabled) =>
    this.step(`clickSwitch ${section}`, () => this.click(personalisationSectionTestIds.switch(section)));
}
