import type { AccentColour, ThemeMode } from "@overview/domain";

export const appearanceSectionTestIds = {
  root: "AppearanceSection.root",
  themeLine: "AppearanceSection.themeLine",
  status: "AppearanceSection.status",
  theme: (theme: ThemeMode) => `AppearanceSection.theme.${theme}`,
  accent: (accentColour: AccentColour) => `AppearanceSection.accent.${accentColour}`,
  accentCheck: "AppearanceSection.accentCheck",
};
