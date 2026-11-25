import { useMemo, useState, type ReactNode } from "react";
import { createFetchFeedbackApi } from "@overview/sync";
import { useClientSurface, useSurface } from "../../app/SurfaceContext.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { usePlan } from "../plus/usePlan.js";
import { useSync } from "../sync/SyncContext.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { FeedbackDialog } from "./components/FeedbackDialog/FeedbackDialog.js";
import { FeedbackProvider, type FeedbackAbout, type FeedbackBox } from "./FeedbackContext.js";
import { readFeedbackDraft, writeFeedbackDraft } from "./feedbackDraftStorage.js";

interface Opened {
  about: FeedbackAbout | null;
  returnFocusTo: HTMLElement | null;
  draft: string;
}

// Signed in only (owner, 23 Nov): docs/features/feedback.md, "Decisions".
export const FeedbackRuntime = ({ children }: { children: ReactNode }) => {
  const { connected } = useSync();
  const { apiUrl, token, accountId } = useSyncConnection().connection;
  const clientSurface = useClientSurface();
  const surface = useSurface();
  const analytics = useAnalytics();
  const errors = useErrorReporter();
  const { plan } = usePlan();
  const [opened, setOpened] = useState<Opened | null>(null);

  const api = useMemo(
    () => (connected && apiUrl !== null ? createFetchFeedbackApi({ baseUrl: apiUrl, token, surface: clientSurface }) : null),
    [connected, apiUrl, token, clientSurface],
  );

  const box = useMemo<FeedbackBox | null>(
    () =>
      api === null
        ? null
        : {
            open: ({ about, from, returnFocusTo }) => {
              analytics.feedback.box.opened({ plan, from });
              setOpened({ about, returnFocusTo, draft: readFeedbackDraft(accountId, about?.overviewId ?? null) });
            },
          },
    [api, analytics, plan, accountId],
  );

  const shut = () => setOpened(null);

  const [shown, setShown] = useState(opened);
  if (opened !== null && shown !== opened) {
    setShown(opened);
  }
  const overviewId = shown?.about?.overviewId ?? null;

  return (
    <FeedbackProvider value={box}>
      {children}
      {shown !== null && api !== null && (
        <FeedbackDialog
          open={opened !== null}
          returnFocusTo={shown.returnFocusTo ?? null}
          about={shown.about}
          draft={shown.draft}
          onDraftChange={(text) => writeFeedbackDraft(accountId, overviewId, text)}
          onSend={(request) => api.send({ ...request, surface, ...(request.kind === "wrong" ? { trail: errors.trail() } : {}) })}
          onSent={(kind) => analytics.feedback.box.sent({ plan, kind: kind ?? "none", fromOverview: overviewId !== null })}
          onFailed={(reason) => analytics.feedback.box.failed({ plan, reason })}
          onClose={(draftKept) => {
            analytics.feedback.box.closed({ plan, draftKept });
            shut();
          }}
          onDone={shut}
        />
      )}
    </FeedbackProvider>
  );
};
