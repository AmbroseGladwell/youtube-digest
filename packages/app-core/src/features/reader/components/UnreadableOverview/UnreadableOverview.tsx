import { useNavigate } from "react-router";
import { OverviewId, type UnreadableRecord } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { ErrorState } from "../../../../components/shared/ErrorState/ErrorState.js";
import { useNewOverviewRunController } from "../../../newOverview/NewOverviewRunContext.js";
import styles from "./UnreadableOverview.module.scss";
import { unreadableOverviewTestIds } from "./UnreadableOverviewTestIds.js";

export interface UnreadableOverviewProps {
  record: UnreadableRecord;
}

// The safe action takes the prominent slot and the destructive one is a sentence: watching
// costs nothing, while regenerating replaces the very record a later migration could have
// recovered. A held-back record is not offered it at all, because writing this client's
// version over a newer one is the clobber the read rule exists to prevent
// (docs/features/record-migrations.md).
export function UnreadableOverview({ record }: UnreadableOverviewProps) {
  const navigate = useNavigate();
  const { start } = useNewOverviewRunController();

  const heldBack = record.reason === "future-version";
  const videoUrl = record.salvaged?.video?.url ?? null;
  const overviewId = OverviewId.safeParse(record.id);
  const canGenerateAgain = !heldBack && videoUrl !== null && overviewId.success;

  const generateAgain = () => {
    if (videoUrl === null || !overviewId.success) {
      return;
    }
    start(videoUrl, { overviewId: overviewId.data });
    void navigate(Routes.home());
  };

  return (
    <ErrorState
      title={
        heldBack
          ? "This overview needs a newer version"
          : "This overview was saved in an older format"
      }
      body={
        heldBack ? (
          "It was saved by a newer version of the app than this one. Nothing has been lost — update, and it will be here."
        ) : (
          <>
            Nothing has been lost: it is still saved, and a later update may be able to read it.
            {canGenerateAgain && (
              <>
                {" "}
                You can also{" "}
                <button
                  type="button"
                  className={styles.inlineLink}
                  onClick={generateAgain}
                  data-testid={unreadableOverviewTestIds.generateAgain}
                >
                  generate it again
                </button>
                , which costs a fresh run and replaces what is saved.
              </>
            )}
          </>
        )
      }
      action={videoUrl === null ? undefined : { label: "Watch on YouTube", href: videoUrl }}
      back
    />
  );
}
