import type { SharedOverview } from "./SharedOverview.js";

export const SHARE_PAYLOAD_ELEMENT_ID = "shared-overview";

// What the document the API writes hands the app. The app never fetches the copy: it is
// already in the page the preview crawler read, so there is one request and no flash of an
// empty reader. Shared by both halves so the element the server writes and the one the app
// looks for cannot drift (docs/features/sharing.md).
export type SharePayload =
  | { state: "shared"; token: string; sharedAt: string; snapshot: SharedOverview }
  | { state: "revoked" }
  | { state: "unknown" };
