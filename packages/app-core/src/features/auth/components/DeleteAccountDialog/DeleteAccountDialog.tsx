import { useEffect, useRef, useState } from "react";
import { SESSION_VERIFICATION_TTL_MINUTES } from "@overview/domain";
import { isSyncRequestError } from "@overview/sync";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDeleteAccount } from "../../../accountLibraries/useDeleteAccount.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useConfirmVerificationMutation } from "../../mutations/useConfirmVerificationMutation.js";
import { useRequestVerificationMutation } from "../../mutations/useRequestVerificationMutation.js";
import { askProblem, codeProblem, type AskProblem, type CodeProblem } from "../../util/accountChangeProblem.js";
import { CodeStep } from "../CodeStep/CodeStep.js";
import styles from "./DeleteAccountDialog.module.scss";
import { deleteAccountDialogTestIds } from "./DeleteAccountDialogTestIds.js";

export interface DeleteAccountDialogProps {
  email: string;
  accountId: string;
  onClose: () => void;
}

type Step =
  | { kind: "explain"; checking: boolean; refused: AskProblem | null }
  | { kind: "code"; expiresAt: string; sentAt: number }
  | { kind: "deleting" }
  | { kind: "failed" };

const HEADING_ID = "DeleteAccountDialog-heading";

const DELETED = [
  "Your account: its email, name and any email change in progress",
  "Your synced library and settings",
  "Every signed-in device, and any connected assistant",
  "Your shared links, which stop working",
  "The narration made for your overviews",
  "Your analytics and error reports, which our analytics provider erases once we ask",
  "On this device, the account’s overviews and reading positions",
];

const KEPT = [
  "Overviews you made on this device before you signed in",
  "Copies already on your other devices. They’re signed out there and won’t sync again.",
  "A note that your account fetched a video’s captions, kept for a year from when it did",
];

// Designs 184b–184d: one dialog in the Delete overview shell. The first step deletes
// nothing and names what goes and what stays; Continue asks for the code to the account's
// own address, or goes straight to deleting for a session that just signed in; a failure
// before the commit says nothing was deleted (docs/features/account-deletion.md).
export function DeleteAccountDialog({ email, accountId, onClose }: DeleteAccountDialogProps) {
  const analytics = useAnalytics();
  const dialog = useRef<HTMLDialogElement | null>(null);
  const cancel = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const [step, setStep] = useState<Step>({ kind: "explain", checking: false, refused: null });
  const [problem, setProblem] = useState<CodeProblem | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const requestVerification = useRequestVerificationMutation();
  const confirmVerification = useConfirmVerificationMutation();
  const deleteAccount = useDeleteAccount();

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
      cancel.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (step.kind === "failed") heading.current?.focus();
  }, [step.kind]);

  const runDeletion = () => {
    setStep({ kind: "deleting" });
    deleteAccount(accountId).catch((error: unknown) => {
      if (isSyncRequestError(error) && error.code === "verification_required") {
        analytics.settings.sync.deleteAccountRefused({ reason: "notVerified" });
        askToVerify(false);
        return;
      }
      analytics.settings.sync.deleteAccountRefused({ reason: "failed" });
      setStep({ kind: "failed" });
    });
  };

  const askToVerify = (resend: boolean) => {
    if (!resend) setStep({ kind: "explain", checking: true, refused: null });
    requestVerification.mutate("deleteAccount", {
      onSuccess: (asked) => {
        if (!asked.required) {
          runDeletion();
          return;
        }
        setProblem(null);
        setStatus(resend ? `Sent a new code to ${asked.email}.` : null);
        setStep({ kind: "code", expiresAt: asked.expiresAt, sentAt: Date.now() });
      },
      onError: (error) => {
        const refused = askProblem(error, new Date());
        if (refused.kind === "limited") analytics.settings.sync.deleteAccountRefused({ reason: "limited" });
        if (resend) {
          setProblem({ kind: refused.kind === "limited" ? "limited" : "other", message: refused.message });
          return;
        }
        setStep({ kind: "explain", checking: false, refused });
      },
    });
  };

  const closable = step.kind !== "deleting";

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={HEADING_ID}
      onCancel={(event) => {
        event.preventDefault();
        if (closable) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current && closable) onClose();
      }}
      data-testid={deleteAccountDialogTestIds.root}
      data-step={step.kind}
    >
      <div className={styles.panel}>
        <span className={styles.handle} aria-hidden="true" />

        {step.kind === "explain" && (
          <>
            <div className={styles.head}>
              <h2 className={styles.heading} id={HEADING_ID} data-testid={deleteAccountDialogTestIds.heading}>
                Delete your account?
              </h2>
              <button type="button" className={styles.close} onClick={onClose} aria-label="Close" data-testid={deleteAccountDialogTestIds.closeButton}>
                <StrokeIcon name="close" size={18} />
              </button>
            </div>
            <p className={styles.body} data-testid={deleteAccountDialogTestIds.body}>
              Your account and everything in it are deleted straight away. This can’t be undone: signing in again with{" "}
              <strong>{email}</strong> starts a new, empty account.
            </p>
            <div className={styles.group}>
              <p className={styles.groupLabel}>Deleted</p>
              <ul className={styles.list} data-testid={deleteAccountDialogTestIds.deletedList}>
                {DELETED.map((line) => (
                  <li key={line}>
                    <span className={styles.dot} aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.group}>
              <p className={styles.groupLabel}>Kept</p>
              <ul className={styles.list} data-testid={deleteAccountDialogTestIds.keptList}>
                {KEPT.map((line) => (
                  <li key={line}>
                    <span className={styles.dot} aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            {step.refused !== null && (
              <p className={styles.refused} role="alert" data-testid={deleteAccountDialogTestIds.refused}>
                <StrokeIcon name="alertCircle" size={15} />
                <span>{step.refused.message}</span>
              </p>
            )}
            {step.checking ? (
              <p className={styles.checking} role="status" data-testid={deleteAccountDialogTestIds.checking}>
                <span className={styles.spinner}>
                  <StrokeIcon name="loader" size={16} />
                </span>
                Checking it’s you…
              </p>
            ) : (
              <div className={styles.foot}>
                {step.refused?.kind !== "limited" && (
                  <button
                    type="button"
                    className={styles.primaryAction}
                    onClick={() => {
                      analytics.settings.sync.deleteAccountStarted();
                      askToVerify(false);
                    }}
                    data-testid={deleteAccountDialogTestIds.continueButton}
                  >
                    Continue
                  </button>
                )}
                <button type="button" ref={cancel} className={styles.quietAction} onClick={onClose} data-testid={deleteAccountDialogTestIds.cancelButton}>
                  Cancel
                </button>
              </div>
            )}
          </>
        )}

        {step.kind === "code" && (
          <>
            <button type="button" className={`${styles.close} ${styles.closeFloating}`} onClick={onClose} aria-label="Close" data-testid={deleteAccountDialogTestIds.closeButton}>
              <StrokeIcon name="close" size={18} />
            </button>
            <CodeStep
              variant="dialog"
              headingId={HEADING_ID}
              heading="Confirm it’s you"
              lead={
                <>
                  We sent a code to <strong>{email}</strong>. Enter it to delete your account.
                </>
              }
              note={`It works for ${SESSION_VERIFICATION_TTL_MINUTES} minutes, and makes sure the deletion comes from you rather than someone else on a signed-in device.`}
              submitLabel="Delete my account"
              canSubmit={problem === null || problem.kind === "wrong" || problem.kind === "other"}
              submitting={confirmVerification.isPending}
              problem={problem?.message ?? null}
              status={status}
              sentAt={step.sentAt}
              canResend={problem?.kind !== "limited"}
              resending={requestVerification.isPending}
              onSubmit={(code) =>
                confirmVerification.mutate(code, {
                  onSuccess: () => {
                    setProblem(null);
                    setStatus(null);
                    runDeletion();
                  },
                  onError: (error) => {
                    setProblem(codeProblem(error, step.expiresAt, new Date()));
                    setStatus(null);
                  },
                })
              }
              onResend={() => askToVerify(true)}
              onCancel={onClose}
            />
          </>
        )}

        {step.kind === "deleting" && (
          <>
            <h2 className={styles.heading} id={HEADING_ID} data-testid={deleteAccountDialogTestIds.heading}>
              Deleting your account…
            </h2>
            <p className={styles.checking} role="status" data-testid={deleteAccountDialogTestIds.deleting}>
              <span className={styles.spinner}>
                <StrokeIcon name="loader" size={16} />
              </span>
              This takes a moment. Keep this page open.
            </p>
          </>
        )}

        {step.kind === "failed" && (
          <>
            <div className={styles.head}>
              <h2 className={styles.heading} id={HEADING_ID} ref={heading} tabIndex={-1} data-testid={deleteAccountDialogTestIds.heading}>
                Your account wasn’t deleted
              </h2>
              <button type="button" className={styles.close} onClick={onClose} aria-label="Close" data-testid={deleteAccountDialogTestIds.closeButton}>
                <StrokeIcon name="close" size={18} />
              </button>
            </div>
            <p className={styles.refused} role="alert" data-testid={deleteAccountDialogTestIds.failed}>
              <StrokeIcon name="alertCircle" size={15} />
              <span>Something went wrong on our side, so nothing was deleted and you’re still signed in.</span>
            </p>
            <p className={styles.body}>Try again now, or come back to it later.</p>
            <div className={styles.foot}>
              <button type="button" className={styles.primaryAction} onClick={runDeletion} data-testid={deleteAccountDialogTestIds.tryAgainButton}>
                Try again
              </button>
              <button type="button" className={styles.quietAction} onClick={onClose} data-testid={deleteAccountDialogTestIds.cancelButton}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
