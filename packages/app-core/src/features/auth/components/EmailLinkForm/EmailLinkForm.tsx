import { useId, useState, type FormEvent, type ReactNode } from "react";
import { FirstName, type AuthIntent } from "@overview/domain";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { isUrl } from "../../util/isUrl.js";
import { looksLikeEmail } from "../../util/looksLikeEmail.js";
import styles from "./EmailLinkForm.module.scss";
import { emailLinkFormTestIds } from "./EmailLinkFormTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";

export interface EmailLinkFormValues {
  email: string;
  firstName: string | null;
  serverUrl: string | null;
}

export interface EmailLinkFormProps {
  intent: AuthIntent;
  submitLabel: string;
  initialEmail?: string;
  initialFirstName?: string | null;
  // The web app's server is its own origin. The extension knows the one it was built for
  // and can be pointed at another (docs/architecture/deploy.md, "The extension").
  askForServer?: "never" | "always" | "onRequest";
  initialServerUrl?: string | null;
  note: string | null;
  // Small print read before the button, directly above it (design 62j).
  aboveSubmit?: ReactNode;
  switchLink?: ReactNode;
  sending: boolean;
  refused: string | null;
  onSubmit: (values: EmailLinkFormValues) => void;
}

// Checked here before anything is sent (design 9i); what the server refuses is said in
// the same place.
export function EmailLinkForm({
  intent,
  submitLabel,
  initialEmail = "",
  initialFirstName = null,
  initialServerUrl = null,
  askForServer = "never",
  note,
  aboveSubmit,
  switchLink,
  sending,
  refused,
  onSubmit,
}: EmailLinkFormProps) {
  const analytics = useAnalytics();
  const isPanel = useIsPanel();
  const isPhone = useIsPhone();
  const footed = isPanel || isPhone;
  const ids = useId();
  const [email, setEmail] = useState(initialEmail);
  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [serverUrl, setServerUrl] = useState(initialServerUrl ?? "");
  const [serverShown, setServerShown] = useState(askForServer === "always");
  const [problem, setProblem] = useState<{ field: "firstName" | "email" | "server"; message: string } | null>(null);
  const creating = intent === "createAccount";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = FirstName.safeParse(firstName);
    if (creating && !name.success) {
      setProblem({ field: "firstName", message: "Tell us what to call you." });
      return;
    }
    if (!looksLikeEmail(email)) {
      setProblem({ field: "email", message: "That doesn't look like a full email address." });
      return;
    }
    if (serverShown && !isUrl(serverUrl.trim())) {
      setProblem({ field: "server", message: "The server address has to be a URL." });
      return;
    }
    setProblem(null);
    onSubmit({
      email: email.trim(),
      firstName: creating && name.success ? name.data : null,
      serverUrl: serverShown ? serverUrl.trim() : null,
    });
  };

  const errorFor = (field: "firstName" | "email" | "server") => {
    const message = problem?.field === field ? problem.message : field === "email" ? refused : null;
    return message === null ? null : (
      <span className={styles.error} id={`${ids}-${field}-error`} data-testid={emailLinkFormTestIds.fieldError}>
        <StrokeIcon name="alertCircle" size={14} />
        {message}
      </span>
    );
  };

  const describedBy = (field: "firstName" | "email" | "server") =>
    errorFor(field) === null ? undefined : `${ids}-${field}-error`;

  const button = (
    <button
      type="submit"
      className={styles.submit}
      disabled={sending}
      data-testid={emailLinkFormTestIds.submitButton}
    >
      {submitLabel}
    </button>
  );
  const noteLine =
    note === null ? null : (
      <p className={styles.note} data-testid={emailLinkFormTestIds.savedOverviewsNote}>
        {note}
      </p>
    );
  const switchLine = switchLink === undefined ? null : <p className={styles.switch}>{switchLink}</p>;

  return (
    <form
      className={`${styles.root} ${footed ? styles.footed : ""}`}
      onSubmit={submit}
      noValidate
      data-testid={emailLinkFormTestIds.root}
    >
      <div className={styles.fields}>
        {serverShown && (
          <label className={styles.label}>
            <span className={styles.labelText}>Server address</span>
            <span className={`${styles.field} ${problem?.field === "server" ? styles.fieldInvalid : ""}`}>
              <StrokeIcon name="link" size={16} />
              <input
                id={`${ids}-server`}
                name="server-url"
                className={styles.input}
                type="url"
                autoComplete="off"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                aria-invalid={problem?.field === "server"}
                aria-describedby={describedBy("server")}
                data-testid={emailLinkFormTestIds.serverInput}
              />
            </span>
            {errorFor("server")}
          </label>
        )}
        {creating && (
          <label className={styles.label}>
            <span className={styles.labelRow}>
              <span className={styles.labelText}>First name</span>
              {!footed && <span className={styles.labelHint}>So we know what to call you</span>}
            </span>
            <span className={`${styles.field} ${problem?.field === "firstName" ? styles.fieldInvalid : ""}`}>
              <StrokeIcon name="user" size={16} />
              <input
                id={`${ids}-given-name`}
                name="given-name"
                className={styles.input}
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                aria-invalid={problem?.field === "firstName"}
                aria-describedby={describedBy("firstName")}
                data-testid={emailLinkFormTestIds.firstNameInput}
              />
            </span>
            {errorFor("firstName")}
          </label>
        )}
        <label className={styles.label}>
          <span className={styles.labelText}>Email</span>
          <span
            className={`${styles.field} ${problem?.field === "email" || refused !== null ? styles.fieldInvalid : ""}`}
          >
            <StrokeIcon name="mail" size={16} />
            <input
              id={`${ids}-email`}
              name="email"
              className={styles.input}
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={problem?.field === "email" || refused !== null}
              aria-describedby={describedBy("email")}
              data-testid={emailLinkFormTestIds.emailInput}
            />
          </span>
          {errorFor("email")}
        </label>
      </div>

      {askForServer === "onRequest" && !serverShown && (
        <button
          type="button"
          className={styles.quiet}
          onClick={() => {
            analytics.account.signIn.serverFieldShown();
            setServerShown(true);
          }}
          data-testid={emailLinkFormTestIds.otherServerButton}
        >
          Use a different server
        </button>
      )}

      {footed ? (
        <div className={styles.footer}>
          {noteLine}
          {aboveSubmit}
          {button}
          {switchLine}
        </div>
      ) : (
        <>
          <div className={styles.submitGroup}>
            {aboveSubmit}
            <div>{button}</div>
          </div>
          {noteLine}
          {switchLine}
        </>
      )}
    </form>
  );
}
