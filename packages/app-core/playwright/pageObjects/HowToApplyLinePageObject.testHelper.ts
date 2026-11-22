import { expect } from "@playwright/experimental-ct-react";
import { howToApplyLineTestIds } from "../../src/features/reader/components/HowToApplyLine/HowToApplyLineTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class HowToApplyLinePageObject extends PageObject {
  verifySampleLine = () =>
    this.step("verifySampleLine", () =>
      expect(this.get(howToApplyLineTestIds.sampleLine)).toHaveText(
        "Written for anyone, like every sample. The overviews you make are written for you.",
      ),
    );
}
