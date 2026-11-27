import { expect } from "@playwright/experimental-ct-react";
import { bottomSheetTestIds } from "../../src/components/shared/BottomSheet/BottomSheetTestIds.js";
import { aboutYouAskTestIds } from "../../src/features/newOverview/components/AboutYouAsk/AboutYouAskTestIds.js";
import { justNowListTestIds } from "../../src/features/newOverview/components/JustNowList/JustNowListTestIds.js";
import { AboutYouSentencePageObject } from "./AboutYouSentencePageObject.testHelper.js";
import { BottomSheetPageObject } from "./BottomSheetPageObject.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";

// OV-356: About you, asked once more at a save (designs 356a–356f).
export class AboutYouAskPageObject extends PageObject {
  get sentence(): AboutYouSentencePageObject {
    return new AboutYouSentencePageObject(this.testContext, this.get(aboutYouAskTestIds.sheet));
  }

  get sheet(): BottomSheetPageObject {
    return new BottomSheetPageObject(this.testContext, this.get(aboutYouAskTestIds.sheet));
  }

  verifyIsShown = () => this.step("verifyIsShown", () => this.expectToBeVisible(aboutYouAskTestIds.root));

  verifyOpensOnItsTitle = () =>
    this.step("verifyOpensOnItsTitle", async () => {
      await this.expectToBeVisible(aboutYouAskTestIds.root);
      await expect(this.get(aboutYouAskTestIds.title)).toBeFocused();
    });

  verifyIsHidden = () => this.step("verifyIsHidden", () => expect(this.get(aboutYouAskTestIds.root)).toBeHidden());

  verifyWaiting = (forThis: string, title: string) =>
    this.step(`verifyWaiting ${forThis}`, async () => {
      const waiting = this.get(aboutYouAskTestIds.waiting);
      await expect(waiting).toContainText(forThis);
      await expect(waiting).toContainText(title);
      await expect(waiting).toContainText("Written for you once you continue");
    });

  verifyNamedAndDescribed = () =>
    this.step("verifyNamedAndDescribed", async () => {
      const dialog = this.page.getByRole("dialog", { name: "Make it yours." });
      await expect(dialog).toHaveAccessibleDescription(
        "Share a little about you, and How to apply and chat answers are written for your life.",
      );
      await expect(dialog.getByTestId(bottomSheetTestIds.close)).toHaveAccessibleName("Close: skip this");
    });

  clickContinue = () => this.step("clickContinue", () => this.click(aboutYouAskTestIds.continue));

  clickSkip = () => this.step("clickSkip", () => this.click(aboutYouAskTestIds.skip));

  verifyRowWaits = () =>
    this.step("verifyRowWaits", () => expect(this.page.getByTestId(justNowListTestIds.waitingForYou)).toHaveText("Waiting for you"));

  verifyRowPersonalised = () =>
    this.step("verifyRowPersonalised", () => expect(this.page.getByTestId(justNowListTestIds.personalised)).toBeVisible());
}
