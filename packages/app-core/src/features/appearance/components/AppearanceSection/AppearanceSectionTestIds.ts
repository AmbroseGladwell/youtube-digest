import type { AccentColour, HeadImageSize, ThemeMode } from "@overview/domain";

export const appearanceSectionTestIds = {
  root: "AppearanceSection.root",
  themeLine: "AppearanceSection.themeLine",
  status: "AppearanceSection.status",
  theme: (theme: ThemeMode) => `AppearanceSection.theme.${theme}`,
  accent: (accentColour: AccentColour) => `AppearanceSection.accent.${accentColour}`,
  accentCheck: "AppearanceSection.accentCheck",
  headImageSize: (size: HeadImageSize) => `AppearanceSection.headImageSize.${size}`,
};
