import { expect } from "@playwright/experimental-ct-react";
import { feedbackDialogTestIds } from "../../src/features/feedback/components/FeedbackDialog/FeedbackDialogTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class FeedbackDialogPageObject extends PageObject {
  verifyIsShown = (): Promise<FeedbackDialogPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(feedbackDialogTestIds.root);
      return this;
    });

  verifyIsNotShown = () => this.step("verifyIsNotShown", () => this.expectToHaveCount(feedbackDialogTestIds.root, 0));

  verifyHeadingReads = (heading: string) =>
    this.step(`verifyHeadingReads ${heading}`, () =>
      expect(this.get(feedbackDialogTestIds.root).getByRole("heading", { level: 2 })).toHaveText(heading),
    );

  verifyIsAbout = (title: string | null) =>
    this.step(`verifyIsAbout ${title}`, () =>
      title === null
        ? this.expectToHaveCount(feedbackDialogTestIds.about, 0)
        : expect(this.get(feedbackDialogTestIds.about)).toHaveText(`About${title}`),
    );

  verifyFieldIsFocused = () => this.step("verifyFieldIsFocused", () => expect(this.get(feedbackDialogTestIds.field)).toBeFocused());

  verifyFieldReads = (text: string) =>
    this.step(`verifyFieldReads ${text}`, () => expect(this.get(feedbackDialogTestIds.field)).toHaveValue(text));

  verifyOffersDraft = (offered: boolean) =>
    this.step(`verifyOffersDraft ${offered}`, () => this.expectToHaveCount(feedbackDialogTestIds.draftNote, offered ? 1 : 0));

  type = (text: string) => this.step("type", () => this.get(feedbackDialogTestIds.field).fill(text));

  chooseKind = (kind: "wrong" | "idea") => this.step(`chooseKind ${kind}`, () => this.click(feedbackDialogTestIds.kind(kind)));

  verifyKindPressed = (kind: "wrong" | "idea", pressed: boolean) =>
    this.step(`verifyKindPressed ${kind} ${pressed}`, () =>
      expect(this.get(feedbackDialogTestIds.kind(kind))).toHaveAttribute("aria-pressed", String(pressed)),
    );

  verifySentWithReads = (line: string) =>
    this.step("verifySentWithReads", () => expect(this.get(feedbackDialogTestIds.sentWith)).toHaveText(line));

  verifySendIsOff = (off: boolean) =>
    this.step(`verifySendIsOff ${off}`, () =>
      expect(this.get(feedbackDialogTestIds.sendButton)).toHaveAttribute("aria-disabled", String(off)),
    );

  verifySendReads = (label: string) =>
    this.step(`verifySendReads ${label}`, () => expect(this.get(feedbackDialogTestIds.sendButton)).toHaveText(label));

  verifyCountReads = (count: string | null) =>
    this.step(`verifyCountReads ${count}`, () =>
      count === null
        ? this.expectToHaveCount(feedbackDialogTestIds.count, 0)
        : expect(this.get(feedbackDialogTestIds.count)).toHaveText(count),
    );

  verifyFailureReads = (message: string) =>
    this.step("verifyFailureReads", async () => {
      await expect(this.get(feedbackDialogTestIds.failure)).toHaveText(message);
      await expect(this.get(feedbackDialogTestIds.failure)).toHaveAttribute("role", "alert");
    });

  clickSend = () => this.step("clickSend", () => this.click(feedbackDialogTestIds.sendButton));

  verifyThanks = () =>
    this.step("verifyThanks", async () => {
      await expect(this.get(feedbackDialogTestIds.sent)).toHaveAttribute("role", "status");
      await expect(this.get(feedbackDialogTestIds.sent).getByRole("heading")).toHaveText("Thanks, we read every one.");
      await expect(this.get(feedbackDialogTestIds.sent).getByRole("heading")).toBeFocused();
    });

  clickDone = () => this.step("clickDone", () => this.click(feedbackDialogTestIds.doneButton));

  clickCancel = () => this.step("clickCancel", () => this.click(feedbackDialogTestIds.cancelButton));

  clickClose = () => this.step("clickClose", () => this.click(feedbackDialogTestIds.closeButton));

  pressEscape = () => this.step("pressEscape", () => this.page.keyboard.press("Escape"));

  verifyBoxCanBeUsed = () => this.step("verifyBoxCanBeUsed", () => this.verifyControlsCanBeReached(this.get(feedbackDialogTestIds.root)));

  verifyLaidOutAsSheet = (sheet: boolean) =>
    this.step(`verifyLaidOutAsSheet ${sheet}`, async () => {
      const viewport = this.page.viewportSize()!;
      await expect(async () => {
        const box = (await this.get(feedbackDialogTestIds.root).boundingBox())!;
        if (sheet) {
          expect(Math.round(box.width)).toBe(viewport.width);
          expect(Math.round(box.y + box.height)).toBe(viewport.height);
        } else {
          expect(box.width).toBeLessThan(viewport.width);
          expect(box.y + box.height).toBeLessThan(viewport.height);
        }
      }).toPass({ timeout: 2_000 });
    });
}
