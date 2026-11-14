import { expect } from "@playwright/experimental-ct-react";
import { makeYourOwnAsideTestIds } from "../../src/features/sharedPage/components/MakeYourOwnAside/MakeYourOwnAsideTestIds.js";
import { sharedOverviewGoneTestIds } from "../../src/features/sharedPage/components/SharedOverviewGone/SharedOverviewGoneTestIds.js";
import { sharedPageHeaderTestIds } from "../../src/features/sharedPage/components/SharedPageHeader/SharedPageHeaderTestIds.js";
import { lineRangeTagTestIds } from "../../src/features/reader/components/LineRangeTag/LineRangeTagTestIds.js";
import { sharedOverviewPageTestIds } from "../../src/features/sharedPage/SharedOverviewPage/SharedOverviewPageTestIds.js";
import { readerTabsTestIds } from "../../src/features/reader/components/ReaderTabs/ReaderTabsTestIds.js";
import { HeadImagePageObject } from "./HeadImagePageObject.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";
import { sharedTranscriptPromptTestIds } from "../../src/features/sharedPage/components/SharedTranscriptPrompt/SharedTranscriptPromptTestIds.js";
import { RelatedByTagPageObject } from "./RelatedByTagPageObject.testHelper.js";
import { ArticleResourcesPageObject } from "./ArticleResourcesPageObject.testHelper.js";

export class SharedOverviewPageObject extends PageObject {
  get resources(): ArticleResourcesPageObject {
    return new ArticleResourcesPageObject(this.testContext);
  }

  get relatedByTag(): RelatedByTagPageObject {
    return new RelatedByTagPageObject(this.testContext);
  }

  get headImage(): HeadImagePageObject {
    return new HeadImagePageObject(this.testContext, this.get(sharedOverviewPageTestIds.root), this.get(sharedOverviewPageTestIds.title));
  }

  verifyHeadImageLeadsWithChannel = () => this.headImage.verifyLeadsWith(this.get(sharedOverviewPageTestIds.channel));

  verifyHeadImageAboveChannel = () => this.headImage.verifyAbove(this.get(sharedOverviewPageTestIds.channel));

  verifyChannelAboveTitle = () =>
    this.step("verifyChannelAboveTitle", async () => {
      const channel = (await this.get(sharedOverviewPageTestIds.channel).boundingBox())!;
      const title = (await this.get(sharedOverviewPageTestIds.title).boundingBox())!;
      expect(channel.y + channel.height).toBeLessThanOrEqual(title.y);
    });

  verifyIsShown = (): Promise<SharedOverviewPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(sharedOverviewPageTestIds.root);
      return this;
    });

  verifyTitleReads = (title: string) =>
    this.step(`verifyTitleReads ${title}`, () => expect(this.get(sharedOverviewPageTestIds.title)).toHaveText(title));

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

  // Signed in, nothing on the page offers an account: the head leads back to their own
  // overviews, and the aside that sells one is not drawn.
  verifyRecognisesTheReader = () =>
    this.step("verifyRecognisesTheReader", async () => {
      await this.expectToBeVisible(sharedPageHeaderTestIds.libraryButton);
      await expect(this.get(sharedPageHeaderTestIds.signInButton)).toHaveCount(0);
      await expect(this.get(sharedPageHeaderTestIds.makeButton)).toHaveCount(0);
      await expect(this.get(makeYourOwnAsideTestIds.root)).toHaveCount(0);
    });

  clickYourOverviewsInHeader = () => this.step("clickYourOverviewsInHeader", () => this.click(sharedPageHeaderTestIds.libraryButton));

  verifySaveActionReads = (label: string) =>
    this.step(`verifySaveActionReads ${label}`, async () => {
      const button = this.get(sharedOverviewPageTestIds.saveButton);
      await expect(button).toHaveText(label);
      await expect(button).toBeEnabled();
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

  openLineTime = (label: string) =>
    this.step(`openLineTime ${label}`, () =>
      this.get(lineRangeTagTestIds.tag)
        .filter({ hasText: new RegExp(`^${label}$`) })
        .click(),
    );

  verifyOffersToReadInTranscript = (offered: boolean) =>
    this.step(`verifyOffersToReadInTranscript ${offered}`, () =>
      offered
        ? this.expectToBeVisible(lineRangeTagTestIds.transcriptButton)
        : this.expectNotToBeVisible(lineRangeTagTestIds.transcriptButton),
    );

  verifyOffersToWatchFrom = (label: string, url: string) =>
    this.step(`verifyOffersToWatchFrom ${label}`, async () => {
      const link = this.get(lineRangeTagTestIds.watchLink);
      await expect(link).toHaveText(label);
      await expect(link).toHaveAttribute("href", url);
    });

  clickTab = (tab: string) => this.step(`clickTab ${tab}`, () => this.click(readerTabsTestIds.tab(tab)));

  verifySaysNoLongerShared = () =>
    this.step("verifySaysNoLongerShared", async () => {
      await this.expectToBeVisible(sharedOverviewGoneTestIds.root);
      await expect(this.get(sharedOverviewGoneTestIds.heading)).toHaveText("This overview is no longer shared");
    });

  clickMakeYourOwnFromGone = () => this.step("clickMakeYourOwnFromGone", () => this.click(sharedOverviewGoneTestIds.makeButton));

  verifySaysLinkGoesNowhere = () =>
    this.step("verifySaysLinkGoesNowhere", () =>
      expect(this.get(sharedOverviewGoneTestIds.heading)).toHaveText("This link doesn’t go anywhere"),
    );

  verifyDoesNotMention = (text: string) =>
    this.step(`verifyDoesNotMention ${text}`, async () => {
      expect(await this.page.content()).not.toContain(text);
    });

  // OV-295: a shared link carries the overview, not the source's words.
  verifyTranscriptOffersOwnCopy = (label: string) =>
    this.step(`verifyTranscriptOffersOwnCopy ${label}`, async () => {
      await this.expectToBeVisible(sharedTranscriptPromptTestIds.root);
      await expect(this.get(sharedTranscriptPromptTestIds.save)).toContainText(label);
      await expect(this.page.getByText("Here is the one claim this video makes.")).toHaveCount(0);
    });

  verifyTranscriptReads = (text: string) =>
    this.step(`verifyTranscriptReads ${text}`, () => expect(this.page.getByText(text)).toBeVisible());

  clickSave = () => this.step("clickSave", () => this.click(sharedOverviewPageTestIds.saveButton));

  pasteLinkAndMakeOverview = (url: string) =>
    this.step(`pasteLinkAndMakeOverview ${url}`, async () => {
      await this.get(makeYourOwnAsideTestIds.urlField).fill(url);
      await this.click(makeYourOwnAsideTestIds.makeButton);
    });

  verifyRefusesLink = () =>
    this.step("verifyRefusesLink", () =>
      expect(this.get(makeYourOwnAsideTestIds.refused)).toHaveText(
        "That doesn't look like a link we can read. Try the address of a video or a web page.",
      ),
    );

  clickMakeAnOverviewInHeader = () => this.step("clickMakeAnOverviewInHeader", () => this.click(sharedPageHeaderTestIds.makeButton));
}
