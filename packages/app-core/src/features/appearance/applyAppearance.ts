import { DEFAULT_ACCENT_COLOUR, DEFAULT_THEME_MODE } from "@overview/domain";
import type { Appearance } from "./appearanceStorage.js";

// public/appearance.js does the same before first paint, in both shells.
export function applyAppearance({ theme, accentColour }: Appearance, root: HTMLElement = document.documentElement): void {
  if (theme === DEFAULT_THEME_MODE) root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);

  if (accentColour === DEFAULT_ACCENT_COLOUR) root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", accentColour);

  for (const link of root.ownerDocument.querySelectorAll<HTMLLinkElement>("link[data-accent-href]")) {
    link.setAttribute("href", (link.dataset.accentHref ?? "").replace("{accent}", accentColour));
  }
}
