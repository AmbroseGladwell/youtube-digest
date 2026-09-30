import { useState } from "react";
import { SharedOverviewPage } from "./SharedOverviewPage/SharedOverviewPage.js";
import { readSharePayload } from "./util/readSharePayload.js";

// The copy arrives in the document rather than over the wire, so it is read once, on the
// first render, and never again (docs/features/sharing.md).
export function SharedOverviewRoute() {
  const [payload] = useState(() => readSharePayload());

  return <SharedOverviewPage payload={payload} />;
}
