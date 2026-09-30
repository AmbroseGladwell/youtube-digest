import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./ConsentAnswer.module.scss";
import { consentAnswerTestIds } from "./ConsentAnswerTestIds.js";

export type ConsentDecision = "approve" | "decline";

export interface ConsentAnswerProps {
  host: string;
  deciding: ConsentDecision | null;
  onDecide: (decision: ConsentDecision) => void;
}

const PERMISSIONS: Array<{ icon: StrokeIconName; text: string; granted: boolean }> = [
  { icon: "check", text: "Read your overviews and their transcripts", granted: true },
  { icon: "circleMinus", text: "Change nothing. Access is read-only", granted: false },
  { icon: "circleMinus", text: "Not see your API keys. They stay on your device", granted: false },
];

// What approving grants, then the answer. Both answers leave for the assistant, so the only
// thing after a press is a pending state (design 58a, 58c).
export function ConsentAnswer({ host, deciding, onDecide }: ConsentAnswerProps) {
  const pendingLabel = deciding === "approve" ? `Sending you back to ${host}…` : "Declining…";

  const button = (decision: ConsentDecision, label: string, className: string, testId: string) => (
    <button
      type="button"
      className={`${className} ${deciding !== null && deciding !== decision ? styles.dimmed : ""}`}
      disabled={deciding !== null}
      aria-disabled={deciding !== null}
      onClick={() => onDecide(decision)}
      data-testid={testId}
    >
      {deciding === decision ? (
        <>
          <span className={styles.spinner}>
            <StrokeIcon name="loader" size={16} />
          </span>
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );

  return (
    <>
      <div className={styles.card} data-testid={consentAnswerTestIds.root}>
        <p className={styles.label}>It will be able to</p>
        <ul className={styles.permissions}>
          {PERMISSIONS.map(({ icon, text, granted }) => (
            <li key={text} className={styles.permission} data-testid={consentAnswerTestIds.permission}>
              <span className={granted ? styles.granted : styles.withheld}>
                <StrokeIcon name={icon} size={17} />
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <p className={styles.footnote}>Revoke it any time in Settings › Connections.</p>
      </div>
      <div className={styles.actions}>
        {button("approve", "Approve", styles.approve!, consentAnswerTestIds.approveButton)}
        {button("decline", "Decline", styles.decline!, consentAnswerTestIds.declineButton)}
        <span className={styles.status} role="status" data-testid={consentAnswerTestIds.status}>
          {deciding === null ? "" : pendingLabel}
        </span>
      </div>
    </>
  );
}
