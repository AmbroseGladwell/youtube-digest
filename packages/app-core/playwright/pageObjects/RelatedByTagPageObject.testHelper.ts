import { expect } from "@playwright/experimental-ct-react";
import { relatedByTagTestIds } from "../../src/features/reader/components/RelatedByTag/RelatedByTagTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { LibraryPageObject } from "./LibraryPageObject.testHelper.js";
import { ReaderPageObject } from "./ReaderPageObject.testHelper.js";

export class RelatedByTagPageObject extends PageObject {
  verifyHeadingReads = (heading: string) =>
    this.step(`verifyHeadingReads ${heading}`, () => expect(this.get(relatedByTagTestIds.heading)).toHaveText(heading));

  verifyTagsRead = (tags: string[]) =>
    this.step(`verifyTagsRead ${tags.join(", ")}`, () =>
      expect(this.page.getByRole("list", { name: "Tags" }).getByRole("listitem")).toHaveText(tags),
    );

  verifyNoTagLinks = () =>
    this.step("verifyNoTagLinks", () =>
      expect(this.page.getByRole("list", { name: "Tags" }).getByRole("link")).toHaveCount(0),
    );

  verifyRelatedRead = (rows: string[]) =>
    this.step(`verifyRelatedRead ${rows.join(", ")}`, () =>
      expect(this.get(relatedByTagTestIds.related).getByRole("link")).toHaveText(rows),
    );

  verifyNoRelated = () => this.step("verifyNoRelated", () => this.expectToHaveCount(relatedByTagTestIds.related, 0));

  verifyNoSection = () => this.step("verifyNoSection", () => this.expectToHaveCount(relatedByTagTestIds.root, 0));

  showMore = (label: string) =>
    this.step(`showMore ${label}`, async () => {
      await expect(this.get(relatedByTagTestIds.showMoreButton)).toHaveText(label);
      await this.click(relatedByTagTestIds.showMoreButton);
    });

  verifyShowMoreIsFocused = (label: string) =>
    this.step(`verifyShowMoreIsFocused ${label}`, async () => {
      await expect(this.get(relatedByTagTestIds.showMoreButton)).toHaveText(label);
      await expect(this.get(relatedByTagTestIds.showMoreButton)).toBeFocused();
    });

  followTag = (tag: string): Promise<LibraryPageObject> =>
    this.step(`followTag ${tag}`, async () => {
      await this.page.getByRole("link", { name: `Show overviews tagged ${tag}` }).click();
      return new LibraryPageObject(this.testContext).verifyIsShown();
    });

  openRelated = (title: string): Promise<ReaderPageObject> =>
    this.step(`openRelated ${title}`, async () => {
      await this.get(relatedByTagTestIds.related).getByRole("link", { name: new RegExp(title) }).click();
      return new ReaderPageObject(this.testContext).verifyIsShown();
    });
}
