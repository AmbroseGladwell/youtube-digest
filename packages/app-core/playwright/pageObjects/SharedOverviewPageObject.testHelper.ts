import { expect } from "@playwright/experimental-ct-react";
import { makeYourOwnAsideTestIds } from "../../src/features/sharedPage/components/MakeYourOwnAside/MakeYourOwnAsideTestIds.js";
import { sharedOverviewGoneTestIds } from "../../src/features/sharedPage/components/SharedOverviewGone/SharedOverviewGoneTestIds.js";
import { sharedPageHeaderTestIds } from "../../src/features/sharedPage/components/SharedPageHeader/SharedPageHeaderTestIds.js";
import { watchAnywayJumpTestIds } from "../../src/features/reader/components/WatchAnywayJump/WatchAnywayJumpTestIds.js";
import { sharedOverviewPageTestIds } from "../../src/features/sharedPage/SharedOverviewPage/SharedOverviewPageTestIds.js";
import { readerTabsTestIds } from "../../src/features/reader/components/ReaderTabs/ReaderTabsTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class SharedOverviewPageObject extends PageObject {
  verifyIsShown = (): Promise<SharedOverviewPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(sharedOverviewPageTestIds.root);
      return this;
    });

  verifyTitleReads = (title: string) =>
    this.step(`verifyTitleReads ${title}`, () =>
      expect(this.get(sharedOverviewPageTestIds.title)).toHaveText(title),
    );

  verifyMetaReads = (text: string) =>
    this.step(`verifyMetaReads ${text}`, () => expect(this.get(sharedOverviewPageTestIds.meta)).toHaveText(text));

  verifyShowsNoOwnerControls = () =>
    this.step("verifyShowsNoOwnerControls", async () => {
      await expect(this.page.getByRole("button", { name: "More" })).toHaveCount(0);
      await expect(this.page.getByRole("button", { name: "Favourite" })).toHaveCount(0);
    });

  verifyOffersTheWayIn = () =>
    this.step("verifyOffersTheWayIn", async () => {
      await this.expectToBeVisible(sharedPageHeaderTestIds.signInButton);
      await this.expectToBeVisible(sharedPageHeaderTestIds.makeButton);
      await this.expectToBeVisible(makeYourOwnAsideTestIds.root);
    });

  // The strip belongs to the text it switches, so its left edge is the note's left edge.
  verifyTabsAlignWithTheNote = () =>
    this.step("verifyTabsAlignWithTheNote", async () => {
      const tabs = (await this.get(readerTabsTestIds.root).boundingBox())!;
      const note = (await this.get(sharedOverviewPageTestIds.title).boundingBox())!;
      expect(Math.round(tabs.x)).toBe(Math.round(note.x));
    });

  // Scrolling must not put the note over the head: the head stays, and the strip rests
  // against it rather than sliding past.
  verifyHeaderStaysAboveTheTabs = () =>
    this.step("verifyHeaderStaysAboveTheTabs", async () => {
      await this.page.mouse.wheel(0, 600);
      await expect(async () => {
        const header = (await this.get(sharedPageHeaderTestIds.root).boundingBox())!;
        const tabs = (await this.get(readerTabsTestIds.root).boundingBox())!;
        expect(Math.round(header.y)).toBe(0);
        expect(tabs.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
      }).toPass({ timeout: 2_000 });
    });

  verifyOffersToWatchFrom = (label: string, url: string) =>
    this.step(`verifyOffersToWatchFrom ${label}`, async () => {
      const link = this.get(watchAnywayJumpTestIds.watchLink);
      await expect(link).toHaveText(label);
      await expect(link).toHaveAttribute("href", url);
    });

  clickTab = (tab: string) => this.step(`clickTab ${tab}`, () => this.click(readerTabsTestIds.tab(tab)));

  verifySaysNoLongerShared = () =>
    this.step("verifySaysNoLongerShared", async () => {
      await this.expectToBeVisible(sharedOverviewGoneTestIds.root);
      await expect(this.get(sharedOverviewGoneTestIds.heading)).toHaveText("This overview is no longer shared");
    });

  verifySaysLinkGoesNowhere = () =>
    this.step("verifySaysLinkGoesNowhere", () =>
      expect(this.get(sharedOverviewGoneTestIds.heading)).toHaveText("This link doesn’t go anywhere"),
    );

  verifyDoesNotMention = (text: string) =>
    this.step(`verifyDoesNotMention ${text}`, async () => {
      expect(await this.page.content()).not.toContain(text);
    });

  verifyTranscriptReads = (text: string) =>
    this.step(`verifyTranscriptReads ${text}`, () => expect(this.page.getByText(text)).toBeVisible());

  clickSave = () => this.step("clickSave", () => this.click(sharedOverviewPageTestIds.saveButton));

  pasteLinkAndMakeOverview = (url: string) =>
    this.step(`pasteLinkAndMakeOverview ${url}`, async () => {
      await this.get(makeYourOwnAsideTestIds.urlField).fill(url);
      await this.click(makeYourOwnAsideTestIds.makeButton);
    });
}
