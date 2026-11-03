import { DEFAULT_HEAD_IMAGE_SIZE, type HeadImageSize } from "@overview/domain";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useUpdateSettingsMutation } from "../settings/mutations/useUpdateSettingsMutation.js";

export interface HeadImageSizeChoice {
  size: HeadImageSize;
  choose: (size: HeadImageSize) => void;
}

// One synced setting, written on press, read by every note with an image and by
// Settings › Appearance (design 151n).
export function useHeadImageSize(): HeadImageSizeChoice {
  const saved = useSettingsQuery().data?.headImageSize ?? DEFAULT_HEAD_IMAGE_SIZE;
  const updateSettings = useUpdateSettingsMutation();
  const size = updateSettings.isPending ? (updateSettings.variables.headImageSize ?? saved) : saved;
  return { size, choose: (headImageSize) => updateSettings.mutate({ headImageSize }) };
}
