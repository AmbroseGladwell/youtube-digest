import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { EMAIL_CHANGE_TTL_MINUTES, SESSION_VERIFICATION_TTL_MINUTES } from "@overview/domain";
import { isSyncRequestError } from "@overview/sync";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useConfirmEmailChangeMutation } from "../../mutations/useConfirmEmailChangeMutation.js";
import { useConfirmVerificationMutation } from "../../mutations/useConfirmVerificationMutation.js";
import { useRequestEmailChangeMutation } from "../../mutations/useRequestEmailChangeMutation.js";
import { useRequestVerificationMutation } from "../../mutations/useRequestVerificationMutation.js";
import { askProblem, codeProblem, type CodeProblem } from "../../util/accountChangeProblem.js";
import { looksLikeEmail } from "../../util/looksLikeEmail.js";
import { CodeStep } from "../CodeStep/CodeStep.js";
import styles from "./EmailChangeFlow.module.scss";
import { emailChangeFlowTestIds } from "./EmailChangeFlowTestIds.js";

export interface EmailChangeFlowProps {
  currentEmail: string;
  onDone: (newEmail: string) => void;
  onCancel: () => void;
}

type Step =
  | { kind: "starting" }
  | { kind: "verifying"; expiresAt: string; sentAt: number }
  | { kind: "newEmail" }
  | { kind: "code"; email: string; expiresAt: string; sentAt: number }
  | { kind: "taken"; email: string };

const normalised = (email: string): string => email.trim().toLowerCase();

// Designs 14c, 14d, 14i: a code to the current address first, unless the session is fresh;
// then the new address; then its code. Every error sits under the field it belongs to, and
// a button that can't work is hidden rather than disabled (docs/features/account-changes.md).
export function EmailChangeFlow({ currentEmail, onDone, onCancel }: EmailChangeFlowProps) {
  const analytics = useAnalytics();
  const ids = useId();
  const [step, setStep] = useState<Step>({ kind: "starting" });
  const [problem, setProblem] = useState<CodeProblem | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [askRefused, setAskRefused] = useState<{ kind: "limited" | "invalid" | "same" | "other"; message: string } | null>(null);
  const newEmailField = useRef<HTMLInputElement | null>(null);
  const requestVerification = useRequestVerificationMutation();
  const confirmVerification = useConfirmVerificationMutation();
  const requestChange = useRequestEmailChangeMutation();
  const confirmChange = useConfirmEmailChangeMutation();
  const started = useRef(false);

  const askToVerify = (resend: boolean) => {
    requestVerification.mutate(undefined, {
      onSuccess: (asked) => {
        if (!resend) analytics.settings.sync.verificationAsked({ required: asked.required });
        if (!asked.required) {
          setStep({ kind: "newEmail" });
          return;
        }
        setProblem(null);
        setStatus(resend ? `Sent a new code to ${asked.email}.` : null);
        setStep({ kind: "verifying", expiresAt: asked.expiresAt, sentAt: Date.now() });
      },
      onError: (error) => {
        const refused = askProblem(error, new Date());
        setStep((current) => (current.kind === "starting" ? { kind: "verifying", expiresAt: new Date(0).toISOString(), sentAt: 0 } : current));
        setProblem({ kind: refused.kind === "limited" ? "limited" : "other", message: refused.message });
        if (refused.kind === "limited") analytics.settings.sync.verificationRefused({ reason: "limited" });
      },
    });
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    askToVerify(false);
    // The ask runs once, when the row opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step.kind === "newEmail") newEmailField.current?.focus();
  }, [step.kind]);

  const askForCode = (email: string, resend: boolean) => {
    requestChange.mutate(email, {
      onSuccess: (asked) => {
        if (!resend) analytics.settings.sync.emailChangeAsked();
        setProblem(null);
        setAskRefused(null);
        setStatus(resend ? `Sent a new code to ${email}.` : null);
        setStep({ kind: "code", email, expiresAt: asked.expiresAt, sentAt: Date.now() });
      },
      onError: (error) => {
        if (isSyncRequestError(error) && error.code === "verification_required") {
          setStep({ kind: "starting" });
          askToVerify(false);
          return;
        }
        const refused = askProblem(error, new Date());
        if (resend) {
          setProblem({ kind: refused.kind === "limited" ? "limited" : "other", message: refused.message });
        } else {
          setAskRefused(refused);
        }
        if (refused.kind === "limited") analytics.settings.sync.emailChangeRefused({ reason: "limited" });
      },
    });
  };

  const submitNewEmail = (event: FormEvent) => {
    event.preventDefault();
    const email = normalised(newEmail);
    if (!looksLikeEmail(email)) {
      setAskRefused({ kind: "invalid", message: "That doesn’t look like a full email address." });
      newEmailField.current?.focus();
      return;
    }
    if (email === normalised(currentEmail)) {
      setAskRefused({ kind: "same", message: "That’s already your email." });
      analytics.settings.sync.emailChangeRefused({ reason: "sameAddress" });
      newEmailField.current?.focus();
      return;
    }
    askForCode(email, false);
  };

  if (step.kind === "starting") {
    return (
      <div className={styles.box} data-testid={emailChangeFlowTestIds.root}>
        <p className={styles.sending} role="status" data-testid={emailChangeFlowTestIds.sending}>
          <span className={styles.spinner}>
            <StrokeIcon name="loader" size={16} />
          </span>
          Checking it’s you…
        </p>
      </div>
    );
  }

  if (step.kind === "verifying") {
    const { expiresAt, sentAt } = step;
    return (
      <div data-testid={emailChangeFlowTestIds.root}>
        <CodeStep
          heading="Confirm it’s you"
          lead={
            <>
              We sent a code to <strong>{currentEmail}</strong>. Enter it to change your email.
            </>
          }
          note={`It works for ${SESSION_VERIFICATION_TTL_MINUTES} minutes, and makes sure the change comes from you rather than someone else on a signed-in device.`}
          submitLabel="Continue"
          canSubmit={problem === null || problem.kind === "wrong" || problem.kind === "other"}
          submitting={confirmVerification.isPending}
          problem={problem?.message ?? null}
          status={status}
          sentAt={sentAt === 0 ? null : sentAt}
          canResend={problem?.kind !== "limited"}
          resending={requestVerification.isPending}
          onSubmit={(code) =>
            confirmVerification.mutate(code, {
              onSuccess: () => {
                analytics.settings.sync.verificationConfirmed();
                setProblem(null);
                setStatus(null);
                setStep({ kind: "newEmail" });
              },
              onError: (error) => {
                const refused = codeProblem(error, expiresAt, new Date());
                setProblem(refused);
                setStatus(null);
                if (refused.kind !== "other") analytics.settings.sync.verificationRefused({ reason: refused.kind });
              },
            })
          }
          onResend={() => askToVerify(true)}
          onCancel={onCancel}
        />
      </div>
    );
  }

  if (step.kind === "newEmail") {
    const refused = askRefused;
    return (
      <form
        className={styles.box}
        onSubmit={submitNewEmail}
        noValidate
        data-testid={emailChangeFlowTestIds.root}
        aria-describedby={`${ids}-hint`}
      >
        <label className={styles.label}>
          <span className={styles.labelText}>New email</span>
          <span className={`${styles.field} ${refused !== null ? styles.fieldInvalid : ""}`}>
            <input
              ref={newEmailField}
              id={`${ids}-email`}
              name="email"
              className={styles.input}
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={newEmail}
              onChange={(event) => {
                setNewEmail(event.target.value);
                if (refused !== null && refused.kind !== "limited") setAskRefused(null);
              }}
              aria-invalid={refused !== null}
              aria-describedby={refused === null ? `${ids}-hint` : `${ids}-error`}
              data-testid={emailChangeFlowTestIds.newEmailInput}
            />
          </span>
        </label>
        {refused === null ? (
          <p className={styles.hint} id={`${ids}-hint`}>
            We’ll email a code to the new address. Your email stays as it is until you enter it.
          </p>
        ) : (
          <p className={styles.error} role="alert" id={`${ids}-error`} data-testid={emailChangeFlowTestIds.newEmailError}>
            <StrokeIcon name="alertCircle" size={15} />
            <span>{refused.message}</span>
          </p>
        )}
        <div className={styles.actions}>
          {refused?.kind !== "limited" && (
            <button
              type="submit"
              className={styles.primary}
              disabled={requestChange.isPending}
              data-testid={emailChangeFlowTestIds.sendCodeButton}
            >
              Send code
            </button>
          )}
          <button type="button" className={styles.ghost} onClick={onCancel} data-testid={emailChangeFlowTestIds.cancelButton}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  if (step.kind === "taken") {
    return (
      <div className={styles.box} data-testid={emailChangeFlowTestIds.root}>
        <h3 className={styles.heading} tabIndex={-1} ref={(element) => element?.focus()}>
          Enter the code
        </h3>
        <p className={styles.error} role="alert" data-testid={emailChangeFlowTestIds.taken}>
          <StrokeIcon name="alertCircle" size={15} />
          <span>
            {step.email} belongs to another account now, so it can’t move to yours. Your email hasn’t changed.
          </span>
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              setStep({ kind: "newEmail" });
              setNewEmail("");
            }}
            data-testid={emailChangeFlowTestIds.takenDifferentAddressButton}
          >
            Use a different address
          </button>
          <button type="button" className={styles.ghost} onClick={onCancel} data-testid={emailChangeFlowTestIds.takenCancelButton}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const { email, expiresAt, sentAt } = step;
  return (
    <div data-testid={emailChangeFlowTestIds.root}>
      <CodeStep
        heading="Enter the code"
        lead={
          <>
            We sent an 8-character code to <strong>{email}</strong>. It works for {EMAIL_CHANGE_TTL_MINUTES} minutes.
          </>
        }
        note="If that address already has an account, the email says so instead, and there’s no code."
        submitLabel="Change email"
        canSubmit={problem === null || problem.kind === "wrong" || problem.kind === "other"}
        submitting={confirmChange.isPending}
        problem={problem?.message ?? null}
        status={status}
        sentAt={sentAt}
        canResend={problem?.kind !== "limited"}
        resending={requestChange.isPending}
        onSubmit={(code) =>
          confirmChange.mutate(code, {
            onSuccess: (info) => {
              analytics.settings.sync.emailChangeConfirmed();
              onDone(info.email);
            },
            onError: (error) => {
              if (isSyncRequestError(error) && error.code === "already_exists") {
                analytics.settings.sync.emailChangeRefused({ reason: "taken" });
                setStep({ kind: "taken", email });
                return;
              }
              const refused = codeProblem(error, expiresAt, new Date());
              setProblem(refused);
              setStatus(null);
              if (refused.kind !== "other") analytics.settings.sync.emailChangeRefused({ reason: refused.kind });
            },
          })
        }
        onResend={() => askForCode(email, true)}
        onCancel={onCancel}
        onDifferentAddress={() => {
          setProblem(null);
          setStatus(null);
          setStep({ kind: "newEmail" });
        }}
      />
    </div>
  );
}
