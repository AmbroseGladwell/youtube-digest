import { useNavigate } from "react-router";
import { domainOf, OverviewId, type UnreadableRecord } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { ErrorState } from "../../../../components/shared/ErrorState/ErrorState.js";
import { useNewOverviewRunController } from "../../../newOverview/NewOverviewRunContext.js";
import { useStartArticleRun } from "../../../newOverview/useStartArticleRun.js";
import { useArticleBeside } from "../../useShowOnPage.js";
import styles from "./UnreadableOverview.module.scss";
import { unreadableOverviewTestIds } from "./UnreadableOverviewTestIds.js";
import { shouldAnimateNavigation } from "../../../../util/viewTransitions.js";

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
  const videoUrl = record.salvaged?.source?.url ?? null;
  const overviewId = OverviewId.safeParse(record.id);
  const canGenerateAgain = !heldBack && videoUrl !== null && overviewId.success;
  const isArticle = record.salvaged?.source?.kind === "web";
  const beside = useArticleBeside(isArticle ? videoUrl : null);
  const startArticleRun = useStartArticleRun();

  const generateAgain = () => {
    if (videoUrl === null || !overviewId.success) {
      return;
    }
    start(videoUrl, { from: "regenerate", overviewId: overviewId.data });
    void navigate(Routes.home(), { viewTransition: shouldAnimateNavigation() });
  };

  // Designs 77ax, 77ay: a video can be remade from anywhere, an article needs to be open.
  if (isArticle && !heldBack && videoUrl !== null) {
    const makeAgain = () => {
      if (beside === null || !overviewId.success) return;
      startArticleRun(beside, { from: "regenerate", overviewId: overviewId.data, willAsk: true });
      void navigate(Routes.home(), { viewTransition: shouldAnimateNavigation() });
    };
    return (
      <ErrorState
        screen="unreadableOverview"
        title="This overview can’t be opened"
        body={
          beside === null
            ? `It was made in an older format this version can’t read. To make it again, open the article on ${domainOf(videoUrl)} and press Create overview in the side panel.`
            : "It was made in an older format this version can’t read. You’re on the article, so you can make it again now."
        }
        action={
          beside === null || !overviewId.success
            ? { label: "Open the article in a new tab", href: videoUrl }
            : { label: "Make it again", onSelect: makeAgain }
        }
        back
      />
    );
  }

  return (
    <ErrorState
      screen="unreadableOverview"
      title={heldBack ? "This overview needs a newer version" : "This overview was saved in an older format"}
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
      action={videoUrl === null ? undefined : { label: isArticle ? "Read the article" : "Watch on YouTube", href: videoUrl }}
      back
    />
  );
}
