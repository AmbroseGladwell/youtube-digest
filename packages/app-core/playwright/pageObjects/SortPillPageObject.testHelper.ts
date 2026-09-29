import { expect } from "@playwright/experimental-ct-react";
import { sortPillTestIds } from "../../src/features/library/components/SortPill/SortPillTestIds.js";
import type { LibrarySort } from "../../src/features/library/types/LibrarySort.js";
import { PageObject } from "./PageObject.testHelper.js";

export class SortPillPageObject extends PageObject {
  sortBy = (sort: LibrarySort) =>
    this.step(`sortBy ${sort}`, async () => {
      await this.click(sortPillTestIds.trigger);
      await this.click(sortPillTestIds.option(sort));
      await this.verifyIsOpen(false);
    });

  verifyReads = (label: string) =>
    this.step(`verifyReads ${label}`, async () => {
      await expect(this.get(sortPillTestIds.trigger)).toHaveText(label);
      await expect(this.get(sortPillTestIds.trigger)).toHaveAccessibleName(`Sort: ${label}`);
    });

  verifyIsOpen = (open: boolean) =>
    this.step(`verifyIsOpen ${open}`, async () => {
      await expect(this.get(sortPillTestIds.trigger)).toHaveAttribute("aria-expanded", String(open));
      await expect(this.get(sortPillTestIds.menu)).toHaveCount(open ? 1 : 0);
    });

  openWithKeyboard = () =>
    this.step("openWithKeyboard", async () => {
      await this.get(sortPillTestIds.trigger).focus();
      await this.page.keyboard.press("Enter");
      await this.verifyIsOpen(true);
    });

  press = (key: string) => this.step(`press ${key}`, () => this.page.keyboard.press(key));

  verifyFocusIsOn = (sort: LibrarySort) =>
    this.step(`verifyFocusIsOn ${sort}`, () => expect(this.get(sortPillTestIds.option(sort))).toBeFocused());

  verifyFocusIsOnTheTrigger = () =>
    this.step("verifyFocusIsOnTheTrigger", () => expect(this.get(sortPillTestIds.trigger)).toBeFocused());

  verifyChecked = (sort: LibrarySort) =>
    this.step(`verifyChecked ${sort}`, () =>
      expect(this.page.getByRole("menuitemradio", { checked: true })).toHaveAttribute(
        "data-testid",
        sortPillTestIds.option(sort),
      ),
    );
}
