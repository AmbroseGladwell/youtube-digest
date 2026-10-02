import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { RouteParams } from "../../app/Routes.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { SharedPageAnalyticsRuntime } from "./SharedPageAnalyticsRuntime.js";
import { SharedOverviewPage } from "./SharedOverviewPage/SharedOverviewPage.js";
import { readSharePayload } from "./util/readSharePayload.js";

// The copy arrives in the document rather than over the wire, so it is read once, on the
// first render, and never again (docs/features/sharing.md).
export function SharedOverviewRoute() {
  const [payload] = useState(() => readSharePayload());
  const token = useParams()[RouteParams.shareToken] ?? "";

  return (
    <SharedPageAnalyticsRuntime token={token}>
      <SharedPageOpened stopped={payload.state !== "shared"} />
      <SharedOverviewPage payload={payload} />
    </SharedPageAnalyticsRuntime>
  );
}

function SharedPageOpened({ stopped }: { stopped: boolean }) {
  const analytics = useAnalytics();
  useEffect(() => analytics.sharedPage.page.opened({ stopped }), [analytics, stopped]);
  return null;
}
