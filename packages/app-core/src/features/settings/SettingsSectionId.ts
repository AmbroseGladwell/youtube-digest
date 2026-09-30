export const SETTINGS_SECTION_IDS = ["account", "voice", "keys", "connections", "plan", "about"] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];
