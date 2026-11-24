import { useEffect, useId, useRef, useState } from "react";
import { MAX_FEEDBACK_LENGTH, sourceImage, type FeedbackKind, type FeedbackRequest } from "@overview/domain";
import { isSyncRequestError, isSyncTransportError } from "@overview/sync";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { FeedbackAbout } from "../../FeedbackContext.js";
import styles from "./FeedbackDialog.module.scss";
import { feedbackDialogTestIds } from "./FeedbackDialogTestIds.js";

export type FeedbackFailure = "offline" | "server" | "tooMany";

export interface FeedbackDialogProps {
  about: FeedbackAbout | null;
  draft: string;
  onDraftChange: (text: string) => void;
  onSend: (request: Omit<FeedbackRequest, "surface">) => Promise<void>;
  onSent: (kind: FeedbackKind | null) => void;
  onFailed: (failure: FeedbackFailure) => void;
  onClose: (draftKept: boolean) => void;
  onDone: () => void;
}

const COUNT_FROM = 3600;
const COUNT_WARNS_FROM = 3950;

const KINDS: Array<{ kind: FeedbackKind; label: string; icon: "alertCircle" | "lightbulb" }> = [
  { kind: "wrong", label: "Something’s wrong", icon: "alertCircle" },
  { kind: "idea", label: "An idea", icon: "lightbulb" },
];

const FAILURE_COPY: Record<FeedbackFailure, string> = {
  offline: "You’re offline, so it didn’t send. Your text is kept; send it when you’re back online.",
  server: "That didn’t send. Your text is kept; try again in a moment.",
  tooMany: "You’ve sent a lot this hour. Try again later; your text is kept.",
};

export const failureOf = (error: unknown): FeedbackFailure => {
  if (isSyncRequestError(error)) {
    return error.status === 429 ? "tooMany" : "server";
  }
  if (globalThis.navigator?.onLine === false || (isSyncTransportError(error) && error.cause instanceof TypeError)) {
    return "offline";
  }
  return "server";
};

const sendLabel = (sending: boolean, failure: FeedbackFailure | null): string => {
  if (sending) {
    return "Sending";
  }
  return failure === "offline" || failure === "server" ? "Send again" : "Send";
};

const sentWith = (about: boolean, kind: FeedbackKind | null): string =>
  [
    "Submitting includes your account id, the app’s version, the app platform",
    about ? ", this overview" : "",
    kind === "wrong" ? ", and the last few things you did in the app, so we can retrace them" : "",
    ".",
  ].join("");

export const FeedbackDialog = ({ about, draft, onDraftChange, onSend, onSent, onFailed, onClose, onDone }: FeedbackDialogProps) => {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const thanks = useRef<HTMLHeadingElement | null>(null);
  const ids = useId();
  const [hadDraft] = useState(draft.trim() !== "");
  const [text, setText] = useState(draft);
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [phase, setPhase] = useState<"editing" | "sending" | "sent">("editing");
  const [failure, setFailure] = useState<FeedbackFailure | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const image = about === null ? null : sourceImage(about.source);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
      const input = field.current;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    }
  }, []);

  useEffect(() => {
    if (phase === "sent") {
      thanks.current?.focus();
    }
  }, [phase]);

  const close = () => {
    if (phase === "sent") {
      onDone();
      return;
    }
    onClose(text.trim() !== "");
  };

  const empty = text.trim() === "";
  const sendOff = empty || phase === "sending" || failure === "tooMany";

  const send = () => {
    if (sendOff) {
      return;
    }
    setPhase("sending");
    setFailure(null);
    onSend({
      text: text.trim(),
      ...(kind === null ? {} : { kind }),
      ...(about === null ? {} : { overviewId: about.overviewId }),
    }).then(
      () => {
        onDraftChange("");
        setPhase("sent");
        onSent(kind);
      },
      (error: unknown) => {
        const failed = failureOf(error);
        setFailure(failed);
        setPhase("editing");
        onFailed(failed);
      },
    );
  };

  const headingId = `${ids}-heading`;
  const kindLabelId = `${ids}-kind`;
  const hintId = `${ids}-hint`;

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) {
          close();
        }
      }}
      data-testid={feedbackDialogTestIds.root}
    >
      <div className={styles.panel}>
        <span className={styles.handle} aria-hidden="true" />
        <button
          type="button"
          className={styles.closeButton}
          onClick={close}
          aria-label="Close"
          data-testid={feedbackDialogTestIds.closeButton}
        >
          <StrokeIcon name="close" size={16} />
        </button>

        {phase === "sent" ? (
          <div className={styles.box} role="status" data-testid={feedbackDialogTestIds.sent}>
            <h2 className={styles.heading} id={headingId} ref={thanks} tabIndex={-1}>
              Thanks, we read every one.
            </h2>
            <p className={styles.lead}>Feedback like yours decides what gets fixed and built next.</p>
            <div className={`${styles.foot} ${styles.footStart}`}>
              <button type="button" className={styles.primaryAction} onClick={onDone} data-testid={feedbackDialogTestIds.doneButton}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.box}>
            <h2 className={styles.heading} id={headingId}>
              {about === null ? "Send feedback" : "Feedback about this overview"}
            </h2>
            {about !== null && (
              <p className={styles.about} data-testid={feedbackDialogTestIds.about}>
                {image && !imageFailed ? (
                  <img className={styles.aboutThumbnail} src={image} alt="" onError={() => setImageFailed(true)} />
                ) : (
                  <span className={`${styles.aboutThumbnail} ${styles.aboutTile}`} aria-hidden="true">
                    <StrokeIcon name="play" size={11} />
                  </span>
                )}
                <span className={styles.aboutLabel}>About</span>
                <b className={styles.aboutTitle}>{about.title}</b>
              </p>
            )}

            <p className={styles.label} id={kindLabelId}>
              What kind? <small className={styles.optional}>Optional</small>
            </p>
            <div className={styles.kinds} role="group" aria-labelledby={kindLabelId}>
              {KINDS.map((option) => (
                <button
                  key={option.kind}
                  type="button"
                  className={`${styles.kind} ${kind === option.kind ? styles.kindOn : ""}`}
                  aria-pressed={kind === option.kind}
                  disabled={phase === "sending"}
                  onClick={() => setKind(kind === option.kind ? null : option.kind)}
                  data-testid={feedbackDialogTestIds.kind(option.kind)}
                >
                  <StrokeIcon name={option.icon} size={15} />
                  {option.label}
                </button>
              ))}
            </div>

            <label className={styles.label} htmlFor={`${ids}-text`}>
              Your feedback
            </label>
            {hadDraft && (
              <p className={styles.draftNote} data-testid={feedbackDialogTestIds.draftNote}>
                Your draft from earlier is still here.
              </p>
            )}
            <textarea
              ref={field}
              id={`${ids}-text`}
              className={styles.field}
              value={text}
              maxLength={MAX_FEEDBACK_LENGTH}
              readOnly={phase === "sending"}
              placeholder={
                about === null
                  ? "e.g. Something that didn’t work, or something you wish it did"
                  : "e.g. The verdict felt wrong, or it missed the point"
              }
              onChange={(event) => {
                setText(event.target.value);
                onDraftChange(event.target.value);
                if (failure !== null && failure !== "tooMany") {
                  setFailure(null);
                }
              }}
              data-testid={feedbackDialogTestIds.field}
            />
            {text.length >= COUNT_FROM && (
              <p
                className={`${styles.count} ${text.length >= COUNT_WARNS_FROM ? styles.countWarns : ""}`}
                aria-live="polite"
                data-testid={feedbackDialogTestIds.count}
              >
                {text.length.toLocaleString("en-GB")} of {MAX_FEEDBACK_LENGTH.toLocaleString("en-GB")}
              </p>
            )}

            {failure !== null && (
              <p className={styles.failure} role="alert" data-testid={feedbackDialogTestIds.failure}>
                <StrokeIcon name={failure === "offline" ? "wifiOff" : "alertCircle"} size={16} />
                <span>{FAILURE_COPY[failure]}</span>
              </p>
            )}

            <p className={styles.sentWith} data-testid={feedbackDialogTestIds.sentWith}>
              {sentWith(about !== null, kind)}
            </p>

            <div className={styles.foot}>
              {empty && (
                <span className={styles.hint} id={hintId}>
                  Write something to send
                </span>
              )}
              <button type="button" className={styles.quietAction} onClick={close} data-testid={feedbackDialogTestIds.cancelButton}>
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.primaryAction} ${sendOff ? styles.actionOff : ""}`}
                aria-disabled={sendOff}
                aria-describedby={empty ? hintId : undefined}
                onClick={send}
                data-testid={feedbackDialogTestIds.sendButton}
              >
                {phase === "sending" && (
                  <span className={styles.spinner} aria-hidden="true">
                    <StrokeIcon name="loader" size={14} />
                  </span>
                )}
                {sendLabel(phase === "sending", failure)}
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
};
