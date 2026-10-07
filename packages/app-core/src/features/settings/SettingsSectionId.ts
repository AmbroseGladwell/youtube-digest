export const SETTINGS_SECTION_IDS = [
  "account",
  "plan",
  "keys",
  "connections",
  "voice",
  "milestones",
  "playlists",
  "shared",
  "privacy",
  "about",
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];
