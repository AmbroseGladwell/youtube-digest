import { expect } from "@playwright/experimental-ct-react";
import { accountMenuTestIds } from "../../src/features/auth/components/AccountMenu/AccountMenuTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { SettingsPageObject } from "./SettingsPageObject.testHelper.js";
import { SignInPageObject } from "./SignInPageObject.testHelper.js";

export type AccountMenuItem =
  | "Sign in"
  | "Create account"
  | "Enter code"
  | "Connect the extension"
  | "Settings"
  | "Sign out"
  | "Sign in again";

export class AccountMenuPageObject extends PageObject {
  open = (): Promise<AccountMenuPageObject> =>
    this.step("open", async () => {
      await this.click(accountMenuTestIds.trigger);
      await this.expectToBeVisible(accountMenuTestIds.menu);
      return this;
    });

  openFromKeyboard = (): Promise<AccountMenuPageObject> =>
    this.step("openFromKeyboard", async () => {
      await this.get(accountMenuTestIds.trigger).focus();
      await this.page.keyboard.press("Enter");
      await this.expectToBeVisible(accountMenuTestIds.menu);
      return this;
    });

  verifyItemsRead = (items: AccountMenuItem[]) =>
    this.step(`verifyItemsRead ${items.join(", ")}`, () =>
      expect(this.get(accountMenuTestIds.menu).getByRole("menuitem")).toHaveText(items),
    );

  verifyFocusedItemReads = (item: AccountMenuItem) =>
    this.step(`verifyFocusedItemReads ${item}`, () =>
      expect(this.get(accountMenuTestIds.menu).getByRole("menuitem", { name: item })).toBeFocused(),
    );

  pressKey = (key: string) => this.step(`pressKey ${key}`, () => this.page.keyboard.press(key));

  verifyIsClosedWithFocusOnTrigger = () =>
    this.step("verifyIsClosedWithFocusOnTrigger", async () => {
      await this.expectToHaveCount(accountMenuTestIds.menu, 0);
      await expect(this.get(accountMenuTestIds.trigger)).toBeFocused();
    });

  verifyTriggerMarksAccountPage = (marked: boolean) =>
    this.step(`verifyTriggerMarksAccountPage ${marked}`, () =>
      expect(this.get(accountMenuTestIds.trigger)).toHaveCSS(
        "box-shadow",
        marked ? /inset/ : "none",
      ),
    );

  verifyTriggerLabel = (label: string) =>
    this.step(`verifyTriggerLabel ${label}`, () =>
      expect(this.get(accountMenuTestIds.trigger)).toHaveAttribute("aria-label", label),
    );

  verifySigningOut = () =>
    this.step("verifySigningOut", async () => {
      await expect(this.get(accountMenuTestIds.signingOut)).toHaveText("Syncing before you sign out…");
      await this.expectToBeVisible(accountMenuTestIds.menu);
    });

  verifySignedInAs = (firstName: string | null, email: string) =>
    this.step(`verifySignedInAs ${firstName} ${email}`, async () => {
      await expect(this.get(accountMenuTestIds.who)).toContainText(email);
      if (firstName === null) {
        await this.expectToHaveCount(accountMenuTestIds.name, 0);
      } else {
        await expect(this.get(accountMenuTestIds.name)).toHaveText(firstName);
      }
    });

  verifySyncStatusShown = (shown: boolean) =>
    this.step(`verifySyncStatusShown ${shown}`, () =>
      shown
        ? this.expectToBeVisible(accountMenuTestIds.syncStatus)
        : this.expectToHaveCount(accountMenuTestIds.syncStatus, 0),
    );

  verifyWaitingForCode = (email: string) =>
    this.step(`verifyWaitingForCode ${email}`, () => expect(this.get(accountMenuTestIds.waiting)).toContainText(email));

  verifySaysAccountsNeedAnotherShell = () =>
    this.step("verifySaysAccountsNeedAnotherShell", () => this.expectToBeVisible(accountMenuTestIds.noAccountsNote));

  chooseSignIn = (): Promise<SignInPageObject> =>
    this.step("chooseSignIn", async () => {
      await this.click(accountMenuTestIds.signInItem);
      return new SignInPageObject(this.testContext).verifyAsksForEmail("Sign in");
    });

  chooseCreateAccount = (): Promise<SignInPageObject> =>
    this.step("chooseCreateAccount", async () => {
      await this.click(accountMenuTestIds.createAccountItem);
      return new SignInPageObject(this.testContext).verifyAsksForEmail("Create your account");
    });

  chooseEnterCode = (): Promise<SignInPageObject> =>
    this.step("chooseEnterCode", async () => {
      await this.click(accountMenuTestIds.enterCodeItem);
      return new SignInPageObject(this.testContext);
    });

  chooseConnectExtension = (): Promise<SignInPageObject> =>
    this.step("chooseConnectExtension", async () => {
      await this.click(accountMenuTestIds.connectExtensionItem);
      return new SignInPageObject(this.testContext);
    });

  chooseSettings = (): Promise<SettingsPageObject> =>
    this.step("chooseSettings", async () => {
      await this.click(accountMenuTestIds.settingsItem);
      return new SettingsPageObject(this.testContext).verifyIsShown();
    });

  chooseSignOut = () => this.step("chooseSignOut", () => this.click(accountMenuTestIds.signOutItem));
}
