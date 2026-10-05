export const SETTINGS_SECTION_IDS = [
  "account",
  "voice",
  "keys",
  "connections",
  "playlists",
  "milestones",
  "shared",
  "plan",
  "privacy",
  "about",
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];
