import type { SettingsSectionId } from "../../SettingsSectionId.js";

export const settingsSectionTestIds = {
  root: (section: SettingsSectionId) => `SettingsSection.root.${section}`,
  heading: (section: SettingsSectionId) => `SettingsSection.heading.${section}`,
};
