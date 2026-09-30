import { useEffect, useRef, useState } from "react";
import type { Share } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { shareStatusLine } from "../../util/shareStatusLine.js";
import { canShareToSystem, shareToSystem } from "../../util/systemShare.js";
import styles from "./ShareOverviewDialog.module.scss";
import { shareOverviewDialogTestIds } from "./ShareOverviewDialogTestIds.js";

export interface ShareOverviewDialogProps {
  share: Share | null;
  edited: boolean;
  signedIn: boolean;
  busy: boolean;
  failed: boolean;
  onCreate: () => void;
  onStop: () => void;
  onSignIn: () => void;
  onClose: () => void;
}

const HEADING_ID = "ShareOverviewDialog-heading";

const SHARED = ["The whole overview, with its audio", "Transcript and chapters", "Video title, channel and link"];
const PRIVATE = ["Your reason", "Your topics", "Read and favourite state"];

export function ShareOverviewDialog({
  share,
  edited,
  signedIn,
  busy,
  failed,
  onCreate,
  onStop,
  onSignIn,
  onClose,
}: ShareOverviewDialogProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const initialFocus = useRef<HTMLButtonElement | null>(null);
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
      initialFocus.current?.focus();
    }
  }, []);

  // Stopping leaves no link to confirm about, so the dialog goes back to its first state
  // rather than asking the question again (design 30c·4).
  useEffect(() => {
    if (share === null) setConfirmingStop(false);
  }, [share]);

  // The label goes back to "Copy link" on its own, so a second copy still reads as one.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    if (share === null) return;
    void navigator.clipboard?.writeText(share.url);
    setCopied(true);
  };

  const body = () => {
    if (!signedIn) {
      return (
        <>
          <p className={styles.body}>
            Shared links belong to an account, so you can find them again and turn them off. Sign in to
            make one.
          </p>
          <div className={styles.foot}>
            <button
              type="button"
              ref={initialFocus}
              className={styles.quietAction}
              onClick={onClose}
              data-testid={shareOverviewDialogTestIds.cancelButton}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={onSignIn}
              data-testid={shareOverviewDialogTestIds.signInButton}
            >
              Sign in
            </button>
          </div>
        </>
      );
    }

    if (confirmingStop) {
      return (
        <>
          <p className={styles.body}>
            The link will say this overview is no longer shared, straight away. If you share it again
            you’ll get a new link.
          </p>
          <div className={styles.foot}>
            <button
              type="button"
              ref={initialFocus}
              className={styles.quietAction}
              onClick={() => setConfirmingStop(false)}
              data-testid={shareOverviewDialogTestIds.keepSharingButton}
            >
              Keep sharing
            </button>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={onStop}
              disabled={busy}
              data-testid={shareOverviewDialogTestIds.confirmStopButton}
            >
              Stop sharing
            </button>
          </div>
        </>
      );
    }

    if (share === null) {
      return (
        <>
          <p className={styles.body}>
            Anyone with the link can read and listen to this overview in a browser, without an account.
            They get a copy as it is now; later edits stay with you until you update the shared copy.
          </p>
          <div className={styles.cards}>
            <div className={styles.card} data-testid={shareOverviewDialogTestIds.shared}>
              <p className={styles.cardLabel}>Shared</p>
              <ul className={styles.cardList}>
                {SHARED.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className={styles.card} data-testid={shareOverviewDialogTestIds.private}>
              <p className={styles.cardLabel}>Kept private</p>
              <ul className={styles.cardList}>
                {PRIVATE.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className={styles.foot}>
            <button
              type="button"
              ref={initialFocus}
              className={styles.quietAction}
              onClick={onClose}
              data-testid={shareOverviewDialogTestIds.cancelButton}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={onCreate}
              disabled={busy}
              data-testid={shareOverviewDialogTestIds.createButton}
            >
              {busy ? "Making a link…" : "Create link"}
              {!busy && <StrokeIcon name="link" size={16} />}
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <p className={styles.status} data-testid={shareOverviewDialogTestIds.status}>
          {shareStatusLine(share.sharedAt, share.views)}
          <span className={styles.liveDot} aria-hidden="true" />
        </p>

        <div className={styles.linkRow}>
          <div className={styles.linkField}>
            <StrokeIcon name="link" size={16} />
            <input
              type="text"
              readOnly
              aria-label="Share link"
              value={share.url}
              onFocus={(event) => event.currentTarget.select()}
              data-testid={shareOverviewDialogTestIds.link}
            />
          </div>
          {canShareToSystem() ? (
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => void shareToSystem({ title: share.title, url: share.url })}
              data-testid={shareOverviewDialogTestIds.systemShareButton}
            >
              Share… <StrokeIcon name="share" size={16} />
            </button>
          ) : null}
          <button
            type="button"
            className={canShareToSystem() ? styles.secondaryAction : styles.primaryAction}
            onClick={copy}
            data-testid={shareOverviewDialogTestIds.copyButton}
          >
            {copied ? "Copied" : "Copy link"}
            <StrokeIcon name={copied ? "check" : "copy"} size={16} />
          </button>
        </div>

        {edited ? (
          <div className={styles.editedNotice} data-testid={shareOverviewDialogTestIds.editedNotice}>
            <p>You’ve edited this overview since sharing it. The link still shows the earlier copy.</p>
            <button
              type="button"
              className={styles.noticeAction}
              onClick={onCreate}
              disabled={busy}
              data-testid={shareOverviewDialogTestIds.updateButton}
            >
              {busy ? "Updating…" : "Update shared copy"}
            </button>
          </div>
        ) : (
          <p className={styles.body}>
            Anyone with this link can read and listen to the shared copy. Your reason and topics aren’t
            in it.
          </p>
        )}

        <div className={styles.footSplit}>
          <button
            type="button"
            className={styles.dangerAction}
            onClick={() => setConfirmingStop(true)}
            data-testid={shareOverviewDialogTestIds.stopButton}
          >
            Stop sharing
          </button>
          <button
            type="button"
            ref={initialFocus}
            className={styles.quietAction}
            onClick={onClose}
            data-testid={shareOverviewDialogTestIds.doneButton}
          >
            Done
          </button>
        </div>
      </>
    );
  };

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={HEADING_ID}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) {
          onClose();
        }
      }}
      data-testid={shareOverviewDialogTestIds.root}
    >
      <div className={styles.panel}>
        <span className={styles.handle} aria-hidden="true" />

        <div className={styles.head}>
          <h2 className={styles.heading} id={HEADING_ID} data-testid={shareOverviewDialogTestIds.heading}>
            {confirmingStop ? "Stop sharing?" : "Share overview"}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            aria-label="Close"
            onClick={onClose}
            data-testid={shareOverviewDialogTestIds.closeButton}
          >
            <StrokeIcon name="close" size={16} />
          </button>
        </div>

        {failed && (
          <p className={styles.failure} role="alert" data-testid={shareOverviewDialogTestIds.failure}>
            That didn’t reach the server. Nothing has changed — try again.
          </p>
        )}

        {body()}
      </div>
    </dialog>
  );
}
