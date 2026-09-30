// Shared links goes after Connections in the design; Connections is not built yet, so it
// sits after API keys until it is (docs/features/sharing.md).
export const SETTINGS_SECTION_IDS = ["account", "voice", "keys", "shared", "plan", "about"] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];
