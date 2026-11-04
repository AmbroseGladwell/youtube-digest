import { expect } from "@playwright/experimental-ct-react";
import type { AboutYouSection } from "@overview/domain";
import { aboutYouEditorTestIds } from "../../src/features/settings/components/AboutYouEditor/AboutYouEditorTestIds.js";
import { aboutYouSentenceTestIds } from "../../src/features/settings/components/AboutYouSentence/AboutYouSentenceTestIds.js";
import { aboutYouSheetTestIds } from "../../src/features/settings/components/AboutYouSheet/AboutYouSheetTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class AboutYouSentencePageObject extends PageObject {
  openSection = (section: AboutYouSection) =>
    this.step(`openSection ${section}`, () => this.click(aboutYouSentenceTestIds.section(section)));

  verifySentenceReads = (text: string) =>
    this.step(`verifySentenceReads ${text}`, () => expect(this.get(aboutYouSentenceTestIds.root)).toHaveText(text));

  verifySectionName = (section: AboutYouSection, name: string) =>
    this.step(`verifySectionName ${section}`, () =>
      expect(this.get(aboutYouSentenceTestIds.section(section))).toHaveAccessibleName(name),
    );

  verifySectionHasFocus = (section: AboutYouSection) =>
    this.step(`verifySectionHasFocus ${section}`, () => expect(this.get(aboutYouSentenceTestIds.section(section))).toBeFocused());

  verifySheetHasFocus = (heading: string) =>
    this.step(`verifySheetHasFocus ${heading}`, () =>
      expect(this.get(aboutYouEditorTestIds.sheet).getByRole("heading", { name: heading })).toBeFocused(),
    );

  pick = (...entries: string[]) =>
    this.step(`pick ${entries.join(", ")}`, async () => {
      for (const entry of entries) await this.click(aboutYouSheetTestIds.suggestion(entry));
    });

  verifyOffered = (entry: string) =>
    this.step(`verifyOffered ${entry}`, () => this.expectToBeVisible(aboutYouSheetTestIds.suggestion(entry)));

  verifyGroups = (...groups: string[]) =>
    this.step(`verifyGroups ${groups.join(", ")}`, async () => {
      const shown = this.get(aboutYouSheetTestIds.root).getByRole("group");
      await expect(shown).toHaveCount(groups.length);
      for (const [index, group] of groups.entries()) await expect(shown.nth(index)).toHaveAccessibleName(group);
    });

  addOwn = (group: string, entry: string) =>
    this.step(`addOwn ${group} ${entry}`, async () => {
      await this.click(aboutYouSheetTestIds.ownOpen(group));
      await expect(this.get(aboutYouSheetTestIds.ownField)).toBeFocused();
      await this.get(aboutYouSheetTestIds.ownField).fill(entry);
      await this.get(aboutYouSheetTestIds.ownField).press("Enter");
    });

  typeOwn = (group: string, text: string) =>
    this.step(`typeOwn ${group}`, async () => {
      await this.click(aboutYouSheetTestIds.ownOpen(group));
      await this.get(aboutYouSheetTestIds.ownField).pressSequentially(text);
    });

  verifyOwnCountReads = (text: string | RegExp) =>
    this.step(`verifyOwnCountReads ${text}`, () => expect(this.get(aboutYouSheetTestIds.ownCount)).toContainText(text));

  closeOwnWithEscape = () =>
    this.step("closeOwnWithEscape", () => this.get(aboutYouSheetTestIds.ownField).press("Escape"));

  verifyOwnChipHasFocus = (group: string) =>
    this.step(`verifyOwnChipHasFocus ${group}`, () => expect(this.get(aboutYouSheetTestIds.ownOpen(group))).toBeFocused());

  verifyInSection = (...entries: string[]) =>
    this.step(`verifyInSection ${entries.join(", ")}`, async () => {
      for (const entry of entries) await this.expectToBeVisible(aboutYouSheetTestIds.chosen(entry));
    });

  remove = (entry: string) => this.step(`remove ${entry}`, () => this.click(aboutYouSheetTestIds.remove(entry)));

  done = () => this.step("done", () => this.click(aboutYouSheetTestIds.done));

  backToSentence = () => this.step("backToSentence", () => this.click(aboutYouEditorTestIds.panelBack));

  clickAwayFromSheet = () => this.step("clickAwayFromSheet", () => this.page.mouse.click(4, 4));

  verifySheetIsClosed = () => this.step("verifySheetIsClosed", () => this.expectNotToBeVisible(aboutYouEditorTestIds.sheet));

  closeSheetWithEscape = () => this.step("closeSheetWithEscape", () => this.page.keyboard.press("Escape"));

  fill = (section: AboutYouSection, ...entries: string[]) =>
    this.step(`fill ${section}`, async () => {
      await this.openSection(section);
      await this.pick(...entries);
      await this.done();
    });
}
