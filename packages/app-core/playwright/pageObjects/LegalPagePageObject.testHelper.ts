import { expect } from "@playwright/experimental-ct-react";
import { legalPageTestIds } from "../../src/features/legal/LegalPage/LegalPageTestIds.js";
import { policyLinksTestIds } from "../../src/features/settings/components/PolicyLinks/PolicyLinksTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class LegalPagePageObject extends PageObject {
  verifyIsShown = (title: string): Promise<LegalPagePageObject> =>
    this.step(`verifyIsShown ${title}`, async () => {
      await this.expectToBeVisible(legalPageTestIds.root);
      await expect(this.get(legalPageTestIds.title)).toHaveText(title);
      await expect(this.get(legalPageTestIds.root).getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(this.page).toHaveTitle(`${title} · The Overview`);
      return this;
    });

  verifyHeadingHasFocus = () => this.step("verifyHeadingHasFocus", () => expect(this.get(legalPageTestIds.title)).toBeFocused());

  verifyLastUpdated = (date: string) =>
    this.step(`verifyLastUpdated ${date}`, () => expect(this.get(legalPageTestIds.updated)).toHaveText(`Last updated ${date}`));

  verifyContentsListEverySection = () =>
    this.step("verifyContentsListEverySection", async () => {
      const sections = this.get(legalPageTestIds.section);
      const headings = await sections.getByRole("heading", { level: 2 }).allTextContents();
      expect(headings.length).toBeGreaterThan(5);
      const contents = this.get(legalPageTestIds.contents).getByRole("link");
      await expect(contents).toHaveText(headings);
      for (const [index, link] of (await contents.all()).entries()) {
        const target = (await link.getAttribute("href"))?.replace(/^#/, "");
        expect(target).toBeTruthy();
        await expect(sections.nth(index)).toHaveAttribute("id", target ?? "");
      }
    });

  verifyNoHorizontalScroll = () =>
    this.step("verifyNoHorizontalScroll", async () => {
      const overflow = await this.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

  openOtherPage = (expectedTitle: string): Promise<LegalPagePageObject> =>
    this.step(`openOtherPage ${expectedTitle}`, async () => {
      await this.click(legalPageTestIds.otherPage);
      return this.verifyIsShown(expectedTitle);
    });

  verifyPolicyLinksRead = (origin: RegExp) =>
    this.step("verifyPolicyLinksRead", async () => {
      for (const [testId, page] of [
        [policyLinksTestIds.privacy, "privacy"],
        [policyLinksTestIds.terms, "terms"],
      ] as const) {
        await expect(this.get(testId)).toHaveAttribute("href", new RegExp(`${origin.source}/${page}$`));
      }
    });
}
