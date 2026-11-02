import { expect } from "@playwright/experimental-ct-react";
import {
  ACCENT_COLOUR_NAMES,
  ACCENT_COLOURS,
  THEME_MODE_NAMES,
  THEME_MODES,
  type AccentColour,
  type ThemeMode,
} from "@overview/domain";
import { appearanceSectionTestIds } from "../../src/features/appearance/components/AppearanceSection/AppearanceSectionTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class AppearanceSectionPageObject extends PageObject {
  chooseTheme = (theme: ThemeMode) =>
    this.step(`chooseTheme ${theme}`, () => this.get(appearanceSectionTestIds.theme(theme)).check());

  chooseAccent = (accentColour: AccentColour) =>
    this.step(`chooseAccent ${accentColour}`, () => this.get(appearanceSectionTestIds.accent(accentColour)).check());

  verifyThemeIs = (theme: ThemeMode) =>
    this.step(`verifyThemeIs ${theme}`, () => expect(this.get(appearanceSectionTestIds.theme(theme))).toBeChecked());

  verifyAccentIs = (accentColour: AccentColour) =>
    this.step(`verifyAccentIs ${accentColour}`, async () => {
      await expect(this.get(appearanceSectionTestIds.accent(accentColour))).toBeChecked();
      await this.expectToHaveCount(appearanceSectionTestIds.accentCheck, 1);
    });

  verifyThemeLineReads = (text: string) =>
    this.step(`verifyThemeLineReads ${text}`, () =>
      expect(this.get(appearanceSectionTestIds.themeLine)).toHaveText(text),
    );

  verifyStatusReads = (text: string) =>
    this.step(`verifyStatusReads ${text}`, () => expect(this.get(appearanceSectionTestIds.status)).toHaveText(text));

  pressArrowDownOnAccent = (accentColour: AccentColour) =>
    this.step(`pressArrowDownOnAccent ${accentColour}`, async () => {
      await this.get(appearanceSectionTestIds.accent(accentColour)).focus();
      await this.page.keyboard.press("ArrowDown");
    });

  verifyChoicesAreNamed = () =>
    this.step("verifyChoicesAreNamed", async () => {
      const themes = this.page.getByRole("radiogroup", { name: "Theme" });
      const accents = this.page.getByRole("radiogroup", { name: "Accent colour" });
      for (const theme of THEME_MODES) {
        await expect(themes.getByRole("radio", { name: THEME_MODE_NAMES[theme] })).toBeVisible();
      }
      for (const accentColour of ACCENT_COLOURS) {
        await expect(accents.getByRole("radio", { name: ACCENT_COLOUR_NAMES[accentColour] })).toBeVisible();
      }
    });

  verifyTilesAreAtLeast = (height: number) =>
    this.step(`verifyTilesAreAtLeast ${height}`, async () => {
      const box = await this.get(appearanceSectionTestIds.accent("gold")).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(height);
    });

  // The attributes the stylesheet answers to, and what it answers with.
  verifyPageIs = ({ theme, accent }: { theme: string | null; accent: string | null }) =>
    this.step(`verifyPageIs ${theme} ${accent}`, () =>
      expect
        .poll(() =>
          this.page.evaluate(() => ({
            theme: document.documentElement.getAttribute("data-theme"),
            accent: document.documentElement.getAttribute("data-accent"),
          })),
        )
        .toEqual({ theme, accent }),
    );

  verifyTokenIs = (token: string, value: string) =>
    this.step(`verifyTokenIs ${token} ${value}`, () =>
      expect
        .poll(() =>
          this.page.evaluate(
            (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim().toLowerCase(),
            token,
          ),
        )
        .toBe(value),
    );

  verifyDeviceCopyIs = (appearance: { theme: ThemeMode; accentColour: AccentColour }) =>
    this.step("verifyDeviceCopyIs", () =>
      expect
        .poll(() => this.page.evaluate(() => JSON.parse(localStorage.getItem("overview.appearance.v1") ?? "null")))
        .toEqual(appearance),
    );
}
