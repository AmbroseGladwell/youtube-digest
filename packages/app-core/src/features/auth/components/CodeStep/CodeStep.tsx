import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { MAGIC_LINK_COOLDOWN_SECONDS, formatClock } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./CodeStep.module.scss";
import { codeStepTestIds } from "./CodeStepTestIds.js";

export interface CodeStepProps {
  heading: string;
  lead: ReactNode;
  note: string;
  submitLabel: string;
  // Hidden rather than disabled when nothing typed could work: a code that has expired,
  // or an hour's codes already spent (CLAUDE.md, "degrade visibly").
  canSubmit: boolean;
  submitting: boolean;
  problem: string | null;
  // Said once a new code has gone, until the reader types.
  status: string | null;
  sentAt: number | null;
  canResend: boolean;
  resending: boolean;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onCancel: () => void;
  onDifferentAddress?: (() => void) | undefined;
  // Inside a dialog the box has no surface of its own and its heading is the dialog's
  // (design 184c, docs/features/account-deletion.md).
  variant?: "box" | "dialog";
  headingId?: string | undefined;
}

const secondsLeft = (sentAt: number, now: number): number =>
  Math.max(0, Math.ceil((sentAt + MAGIC_LINK_COOLDOWN_SECONDS * 1000 - now) / 1000));

// Designs 14d and 14i: one box for both codes, the step-up's and the new address's, so the
// two read as a pair. The heading takes focus when the step arrives; an error keeps focus
// in the field (docs/features/account-changes.md).
export function CodeStep({
  heading,
  lead,
  note,
  submitLabel,
  canSubmit,
  submitting,
  problem,
  status,
  sentAt,
  canResend,
  resending,
  onSubmit,
  onResend,
  onCancel,
  onDifferentAddress,
  variant = "box",
  headingId,
}: CodeStepProps) {
  const ids = useId();
  const [code, setCode] = useState("");
  const [empty, setEmpty] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const waiting = sentAt === null ? 0 : secondsLeft(sentAt, now);

  useEffect(() => {
    headingRef.current?.focus();
  }, [heading]);

  useEffect(() => {
    if (sentAt === null) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (secondsLeft(sentAt, current) === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [sentAt]);

  useEffect(() => {
    if (problem !== null) field.current?.focus();
  }, [problem]);

  const shown = empty ? "Enter the code from the email." : problem;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim() === "") {
      setEmpty(true);
      field.current?.focus();
      return;
    }
    setEmpty(false);
    onSubmit(code.trim());
  };

  return (
    <form
      className={variant === "dialog" ? styles.rootInDialog : styles.root}
      onSubmit={submit}
      noValidate
      data-testid={codeStepTestIds.root}
    >
      <h3
        className={variant === "dialog" ? styles.headingInDialog : styles.heading}
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        data-testid={codeStepTestIds.heading}
      >
        {heading}
      </h3>
      <p className={styles.lead}>{lead}</p>
      <p className={styles.note}>{note}</p>
      <label className={styles.label}>
        <span className={styles.labelText}>Code</span>
        <input
          ref={field}
          id={`${ids}-code`}
          name="one-time-code"
          className={`${styles.code} ${shown !== null ? styles.codeInvalid : ""}`}
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={9}
          placeholder="8 characters"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setEmpty(false);
          }}
          aria-invalid={shown !== null}
          aria-describedby={shown === null ? undefined : `${ids}-error`}
          data-testid={codeStepTestIds.codeInput}
        />
      </label>
      {shown !== null && (
        <p className={styles.error} role="alert" id={`${ids}-error`} data-testid={codeStepTestIds.error}>
          <StrokeIcon name="alertCircle" size={15} />
          <span>{shown}</span>
        </p>
      )}
      {status !== null && shown === null && (
        <p className={styles.status} role="status" aria-live="polite" data-testid={codeStepTestIds.status}>
          <StrokeIcon name="check" size={15} />
          <span>{status}</span>
        </p>
      )}
      <div className={styles.actions}>
        {canSubmit && (
          <button type="submit" className={styles.primary} disabled={submitting} data-testid={codeStepTestIds.submitButton}>
            {submitLabel}
          </button>
        )}
        <button type="button" className={styles.ghost} onClick={onCancel} data-testid={codeStepTestIds.cancelButton}>
          Cancel
        </button>
      </div>
      {(canResend || onDifferentAddress !== undefined) && (
        <div className={styles.secondaryActions}>
          {canResend &&
            (waiting > 0 ? (
              <span className={styles.countdown} data-testid={codeStepTestIds.countdown}>
                <StrokeIcon name="clock" size={14} />
                Send a new code in {formatClock(waiting)}
              </span>
            ) : (
              <button
                type="button"
                className={styles.ghost}
                onClick={onResend}
                disabled={resending}
                data-testid={codeStepTestIds.resendButton}
              >
                Send a new code
              </button>
            ))}
          {onDifferentAddress !== undefined && (
            <button
              type="button"
              className={styles.ghost}
              onClick={onDifferentAddress}
              data-testid={codeStepTestIds.differentAddressButton}
            >
              Use a different address
            </button>
          )}
        </div>
      )}
    </form>
  );
}
