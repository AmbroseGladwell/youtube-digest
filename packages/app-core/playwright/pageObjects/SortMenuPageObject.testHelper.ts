import { expect } from "@playwright/experimental-ct-react";
import { bottomSheetTestIds } from "../../src/components/shared/BottomSheet/BottomSheetTestIds.js";
import { sortMenuTestIds } from "../../src/features/library/components/SortMenu/SortMenuTestIds.js";
import { LIBRARY_SORT_PRESET, type LibrarySortPreset } from "../../src/features/library/types/LibrarySort.js";
import { PageObject } from "./PageObject.testHelper.js";

type SortGroup = "field" | "order" | "group";

export class SortMenuPageObject extends PageObject {
  private menu = () => this.page.getByTestId(sortMenuTestIds.menu);
  private option = (group: SortGroup, value: string) => this.page.getByTestId(sortMenuTestIds.option(group, value));

  open = () =>
    this.step("open", async () => {
      if (!(await this.menu().isVisible())) {
        await this.click(sortMenuTestIds.trigger);
      }
      await this.verifyIsOpen(true);
    });

  close = () =>
    this.step("close", async () => {
      const sheetClose = this.page.getByTestId(bottomSheetTestIds.close);
      if (await sheetClose.isVisible()) {
        await sheetClose.click();
      } else {
        await this.page.keyboard.press("Escape");
      }
      await this.verifyIsOpen(false);
    });

  choose = (group: SortGroup, value: string) =>
    this.step(`choose ${group} ${value}`, async () => {
      await this.open();
      await this.option(group, value).click();
      await expect(this.option(group, value)).toHaveAttribute("aria-checked", "true");
    });

  // One of the three orders the old pill offered, then closed.
  sortBy = (preset: LibrarySortPreset) =>
    this.step(`sortBy ${preset}`, async () => {
      const sort = LIBRARY_SORT_PRESET[preset];
      await this.choose("field", sort.field);
      await this.choose("order", sort.direction);
      await this.close();
    });

  verifyReads = (label: string) =>
    this.step(`verifyReads ${label}`, () => expect(this.get(sortMenuTestIds.trigger)).toHaveAccessibleName(`Sort: ${label}`));

  verifyMarkedChanged = (changed: boolean) =>
    this.step(`verifyMarkedChanged ${changed}`, () => this.expectToHaveCount(sortMenuTestIds.dot, changed ? 1 : 0));

  verifyIsOpen = (open: boolean) =>
    this.step(`verifyIsOpen ${open}`, async () => {
      await expect(this.get(sortMenuTestIds.trigger)).toHaveAttribute("aria-expanded", String(open));
      await expect(this.menu()).toHaveCount(open ? 1 : 0);
    });

  verifyOptionsCanBeReached = () => this.verifyControlsCanBeReached(this.menu());

  verifyGroupsOffered = (groups: string[]) =>
    this.step(`verifyGroupsOffered ${groups.join(", ")}`, () =>
      expect(this.page.getByRole("group", { name: "Group by" }).getByRole("menuitemradio")).toHaveText(groups),
    );

  openWithKeyboard = () =>
    this.step("openWithKeyboard", async () => {
      await this.get(sortMenuTestIds.trigger).focus();
      await this.page.keyboard.press("Enter");
      await this.verifyIsOpen(true);
    });

  press = (key: string) => this.step(`press ${key}`, () => this.page.keyboard.press(key));

  verifyFocusIsOn = (group: SortGroup, value: string) =>
    this.step(`verifyFocusIsOn ${group} ${value}`, () => expect(this.option(group, value)).toBeFocused());

  verifyFocusIsOnTheTrigger = () => this.step("verifyFocusIsOnTheTrigger", () => expect(this.get(sortMenuTestIds.trigger)).toBeFocused());

  verifyChecked = (group: SortGroup, value: string) =>
    this.step(`verifyChecked ${group} ${value}`, () => expect(this.option(group, value)).toHaveAttribute("aria-checked", "true"));
}
