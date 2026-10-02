import { useState } from "react";
import type { Share } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useSharesQuery } from "../../queries/sharesQuery.js";
import { useStopSharingMutation } from "../../mutations/useStopSharingMutation.js";
import { useEditedShares } from "../../useEditedShares.js";
import { shareStatusLine } from "../../util/shareStatusLine.js";
import styles from "./SharedLinksPanel.module.scss";
import { sharedLinksPanelTestIds } from "./SharedLinksPanelTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";

// A stable empty list, so the effect that hashes them is not re-run on every render.
const EMPTY: Share[] = [];

export const SHARED_LINKS_STANDFIRST =
  "Anyone with one of these links can read and listen to that overview without an account. Stopping takes effect straight away.";

// Design 30h: the links the reader has given out, each with the two things they might want
// to do to it. Stopping asks inline, the way revoking a connection does, rather than
// raising a dialog over a list (docs/features/sharing.md).
export function SharedLinksPanel() {
  const shares = useSharesQuery();
  const live = shares.data ?? EMPTY;
  const edited = useEditedShares(live);
  const stopSharing = useStopSharingMutation();
  const [confirming, setConfirming] = useState<string | null>(null);

  if (shares.isPending) {
    return (
      <div className={styles.card} data-testid={sharedLinksPanelTestIds.root}>
        <span className={styles.skeletonRow} />
        <span className={styles.skeletonRow} />
      </div>
    );
  }

  if (live.length === 0) {
    return (
      <div className={styles.card} data-testid={sharedLinksPanelTestIds.root}>
        <div className={styles.empty} data-testid={sharedLinksPanelTestIds.empty}>
          <p className={styles.emptyHeading}>Nothing shared yet</p>
          <p className={styles.emptyBody}>Choose Share… from an overview’s ⋯ menu to make a link.</p>
        </div>
      </div>
    );
  }

  const analytics = useAnalytics();
  const row = (share: Share) =>
    confirming === share.token ? (
      <li key={share.token} className={styles.confirmRow} data-testid={sharedLinksPanelTestIds.confirm}>
        <span className={styles.confirmHeading}>Stop sharing “{share.title}”?</span>
        <span className={styles.confirmBody}>
          The link will say it’s no longer shared, straight away. Sharing again makes a new link.
        </span>
        <span className={styles.confirmActions}>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => {
              analytics.settings.sharedLinks.stopped({ overviewId: share.overviewId });
              stopSharing.mutate({ token: share.token });
              setConfirming(null);
            }}
            data-testid={sharedLinksPanelTestIds.confirmStopButton}
          >
            Stop sharing
          </button>
          <button
            type="button"
            className={styles.surfaceAction}
            onClick={() => {
              analytics.settings.sharedLinks.stopCancelled({ overviewId: share.overviewId });
              setConfirming(null);
            }}
            data-testid={sharedLinksPanelTestIds.keepSharingButton}
          >
            Keep sharing
          </button>
        </span>
      </li>
    ) : (
      <li key={share.token} className={styles.row} data-testid={sharedLinksPanelTestIds.row}>
        <span className={styles.rowText}>
          <span className={styles.rowTitle} data-testid={sharedLinksPanelTestIds.rowTitle}>
            {share.title}
          </span>
          <span className={styles.rowStatus} data-testid={sharedLinksPanelTestIds.rowStatus}>
            {shareStatusLine(share.sharedAt, share.views)}
            {edited.has(share.token) && (
              <span className={styles.editedBadge} data-testid={sharedLinksPanelTestIds.editedBadge}>
                Edited since shared
              </span>
            )}
          </span>
        </span>
        <button
          type="button"
          className={styles.iconAction}
          aria-label={`Copy link to ${share.title}`}
          onClick={() => {
            analytics.settings.sharedLinks.linkCopied({ overviewId: share.overviewId });
            void navigator.clipboard?.writeText(share.url);
          }}
          data-testid={sharedLinksPanelTestIds.copyButton}
        >
          <StrokeIcon name="copy" size={16} />
        </button>
        <button
          type="button"
          className={styles.surfaceAction}
          aria-label={`Stop sharing ${share.title}`}
          onClick={() => {
            analytics.settings.sharedLinks.stopAsked({ overviewId: share.overviewId });
            setConfirming(share.token);
          }}
          data-testid={sharedLinksPanelTestIds.stopButton}
        >
          Stop sharing
        </button>
      </li>
    );

  return (
    <div className={styles.card} data-testid={sharedLinksPanelTestIds.root}>
      <p className={styles.cardLabel}>Live links</p>
      <ul className={styles.rows}>{live.map(row)}</ul>
    </div>
  );
}
