import type { OverviewId, Share } from "@overview/domain";

export const liveShareFor = (shares: Share[] | undefined, overviewId: OverviewId): Share | null =>
  shares?.find((share) => share.overviewId === overviewId) ?? null;
