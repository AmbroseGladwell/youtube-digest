import { expect } from "@playwright/experimental-ct-react";
import { savedItemPageTestIds } from "../../src/features/captures/components/SavedItemPage/SavedItemPageTestIds.js";
import { libraryCaptureCardTestIds } from "../../src/features/library/components/LibraryCaptureCard/LibraryCaptureCardTestIds.js";
import { FilterMenuPageObject } from "./FilterMenuPageObject.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";
import { transcriptPanelTestIds } from "../../src/features/reader/components/TranscriptPanel/TranscriptPanelTestIds.js";

export class SavedItemPageObject extends PageObject {
  verifyLibraryRow = (title: string) =>
    this.step("verifyLibraryRow", async () => {
      const card = this.get(libraryCaptureCardTestIds.root).filter({ hasText: title });
      await expect(card).toBeVisible();
      await expect(card.getByTestId(libraryCaptureCardTestIds.status)).toHaveText("No overview yet · Transcript ready");
    });

  showOnlyWithoutOverview = () =>
    this.step("showOnlyWithoutOverview", async () => {
      const menu = new FilterMenuPageObject(this.testContext);
      await menu.clickWithoutOverviewChip();
      await menu.close();
    });

  openFromLibrary = (title: string) =>
    this.step("openFromLibrary", () =>
      this.click(this.get(libraryCaptureCardTestIds.root).filter({ hasText: title }).getByTestId(libraryCaptureCardTestIds.titleLink)),
    );

  verifyIsShown = (title: string) =>
    this.step("verifyIsShown", async () => {
      await expect(this.get(savedItemPageTestIds.title)).toHaveText(title);
      await expect(this.get(savedItemPageTestIds.noOverview)).toContainText("No overview yet.");
      await this.expectToBeVisible(savedItemPageTestIds.getPlus);
      await this.expectToBeVisible(savedItemPageTestIds.transcript);
    });

  verifyOffersMakingIt = () =>
    this.step("verifyOffersMakingIt", async () => {
      await expect(this.get(savedItemPageTestIds.noOverview)).toContainText("Make its overview now.");
      await this.expectToBeVisible(savedItemPageTestIds.makeOverview);
    });

  makeOverview = () => this.step("makeOverview", () => this.click(savedItemPageTestIds.makeOverview));

  remove = () => this.step("remove", () => this.click(savedItemPageTestIds.remove));

  verifyTitleIs = (title: string) =>
    this.step(`verifyTitleIs ${title}`, () => expect(this.get(savedItemPageTestIds.title)).toHaveText(title));

  openTheMomentSaid = (title: string) =>
    this.step(`openTheMomentSaid ${title}`, () =>
      this.click(this.get(libraryCaptureCardTestIds.root).filter({ hasText: title }).getByTestId(libraryCaptureCardTestIds.saidLink)),
    );

  verifySaidReads = (title: string, said: string) =>
    this.step(`verifySaidReads ${title}`, () =>
      expect(
        this.get(libraryCaptureCardTestIds.root).filter({ hasText: title }).getByTestId(libraryCaptureCardTestIds.saidLink),
      ).toHaveText(said),
    );

  verifyTranscriptOpensAt = (text: RegExp) =>
    this.step(`verifyTranscriptOpensAt ${text.source}`, async () => {
      const target = this.get(transcriptPanelTestIds.row).and(this.page.locator('[data-target="true"]')).first();
      await expect(target.getByTestId(transcriptPanelTestIds.rowText)).toHaveText(text);
      await expect(target).toBeInViewport();
    });
}
