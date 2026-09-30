import type { SettingsSectionId } from "../../SettingsSectionId.js";

export const settingsSectionListTestIds = {
  root: "SettingsSectionList.root",
  row: (section: SettingsSectionId) => `SettingsSectionList.row.${section}`,
  rowValue: (section: SettingsSectionId) => `SettingsSectionList.rowValue.${section}`,
};
