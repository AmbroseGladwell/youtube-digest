import type { AnalyticsPlatform } from "@overview/domain";

interface NavigatorWithUserAgentData {
  userAgent?: string;
  userAgentData?: { platform?: string };
}

// The operating system in one word, from what the browser says about itself: never the
// device, the browser build or anything finer.
export function analyticsPlatform(navigator: NavigatorWithUserAgentData | undefined): AnalyticsPlatform {
  const said = `${navigator?.userAgentData?.platform ?? ""} ${navigator?.userAgent ?? ""}`.toLowerCase();
  if (said.includes("android")) return "android";
  if (/iphone|ipad|ipod/.test(said)) return "ios";
  if (said.includes("cros") || said.includes("chrome os")) return "chromeos";
  if (said.includes("mac")) return "macos";
  if (said.includes("win")) return "windows";
  if (said.includes("linux")) return "linux";
  return "other";
}
