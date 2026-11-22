import type { AnalyticsPlatform } from "./AnalyticsEventBatch.js";

interface NavigatorWithUserAgentData {
  userAgent?: string;
  userAgentData?: { platform?: string };
}

// One word, never the device, the browser build or anything finer.
export const analyticsPlatform = (navigator: NavigatorWithUserAgentData | undefined): AnalyticsPlatform => {
  const said = `${navigator?.userAgentData?.platform ?? ""} ${navigator?.userAgent ?? ""}`.toLowerCase();
  if (said.includes("android")) {
    return "android";
  }
  if (/iphone|ipad|ipod/.test(said)) {
    return "ios";
  }
  if (said.includes("cros") || said.includes("chrome os")) {
    return "chromeos";
  }
  if (said.includes("mac")) {
    return "macos";
  }
  if (said.includes("win")) {
    return "windows";
  }
  if (said.includes("linux")) {
    return "linux";
  }
  return "other";
};
