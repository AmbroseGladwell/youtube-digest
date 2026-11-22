import { z } from "zod";
import { SharedOverview } from "./SharedOverview.js";
import { ShareToken } from "./shareLink.js";

export const SHARE_PAYLOAD_ELEMENT_ID = "shared-overview";

// In the page the crawler read, so there's no fetch and no empty flash (docs/features/sharing.md).
export const SharePayload = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("shared"),
    token: ShareToken,
    sharedAt: z.iso.datetime(),
    snapshot: SharedOverview,
  }),
  z.object({ state: z.literal("revoked") }),
  z.object({ state: z.literal("unknown") }),
]);
export type SharePayload = z.infer<typeof SharePayload>;
