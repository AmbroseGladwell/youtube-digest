import { expect } from "@playwright/experimental-ct-react";
import { openingLibraryTestIds } from "../../src/features/accountLibraries/components/OpeningLibrary/OpeningLibraryTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class OpeningLibraryPageObject extends PageObject {
  verifyIsShown = () =>
    this.step("verifyIsShown", () => expect(this.get(openingLibraryTestIds.status)).toHaveText("Opening your library…"));

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectNotToBeVisible(openingLibraryTestIds.root));
}
