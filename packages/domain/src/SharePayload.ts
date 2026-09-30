import { z } from "zod";
import { SharedOverview } from "./SharedOverview.js";
import { ShareToken } from "./shareLink.js";

export const SHARE_PAYLOAD_ELEMENT_ID = "shared-overview";

// What the document the API writes hands the app. The app never fetches the copy: it is
// already in the page the preview crawler read, so there is one request and no flash of an
// empty reader. Shared by both halves so the element the server writes and the one the app
// looks for cannot drift, and parsed rather than trusted on the way in
// (docs/features/sharing.md).
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
