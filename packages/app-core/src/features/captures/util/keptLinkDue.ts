import type { KeptCapture } from "@overview/domain";

export interface KeptLinkCircumstances {
  now: number;
  hasExtension: boolean;
  monthSpent: boolean;
}

// When a kept link can be made here: docs/features/kept-links.md, "Kept links".
export const keptLinkDue = (link: KeptCapture, { now, hasExtension, monthSpent }: KeptLinkCircumstances): boolean => {
  if (link.queueStatus !== "waiting") {
    return false;
  }
  switch (link.waitingFor) {
    case "extension":
      return hasExtension;
    case "reset":
      return !monthSpent;
    default:
      return hasExtension || link.resumesAt === null || Date.parse(link.resumesAt) <= now;
  }
};
