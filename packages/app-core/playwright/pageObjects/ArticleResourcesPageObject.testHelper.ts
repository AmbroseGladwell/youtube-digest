import { expect } from "@playwright/experimental-ct-react";
import { articleResourcesTestIds } from "../../src/features/reader/components/ArticleResources/ArticleResourcesTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

// The resources an article points to, last in its note, on the reader page or a shared copy (OV-203).
export class ArticleResourcesPageObject extends PageObject {
  private toggle = () => this.get(articleResourcesTestIds.toggle);

  verifyIsNotShown = () => this.step("verifyIsNotShown", () => this.expectToHaveCount(articleResourcesTestIds.root, 0));

  verifyIsClosed = (heading: string, preview: string) =>
    this.step(`verifyIsClosed ${heading} | ${preview}`, async () => {
      await expect(this.toggle()).toHaveAttribute("aria-expanded", "false");
      await expect(this.toggle()).toContainText(heading);
      await expect(this.get(articleResourcesTestIds.preview)).toHaveText(preview);
      await expect(this.get(articleResourcesTestIds.root).getByRole("link")).toHaveCount(0);
    });

  clickToggle = () => this.step("clickToggle", () => this.click(this.toggle()));

  verifyIsOpen = () => this.step("verifyIsOpen", () => expect(this.toggle()).toHaveAttribute("aria-expanded", "true"));

  verifyNamesRead = (names: string[]) =>
    this.step(`verifyNamesRead ${names.join(" | ")}`, () => expect(this.get(articleResourcesTestIds.name)).toHaveText(names));

  verifyWhysRead = (whys: string[]) =>
    this.step(`verifyWhysRead ${whys.length}`, () => expect(this.get(articleResourcesTestIds.why)).toHaveText(whys));

  verifyNameLinksTo = (accessibleName: string, href: string) =>
    this.step(`verifyNameLinksTo ${accessibleName}`, async () => {
      const link = this.page.getByRole("link", { name: accessibleName, exact: true });
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
    });

  verifyFromLinksTo = (accessibleName: string, href: string) =>
    this.step(`verifyFromLinksTo ${accessibleName}`, () =>
      expect(this.page.getByRole("link", { name: accessibleName, exact: true }).first()).toHaveAttribute("href", href),
    );
}
