import { useId, useState, type FormEvent, type ReactNode } from "react";
import { FIRST_NAME_MAX_LENGTH, FirstName, type AuthIntent } from "@overview/domain";
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
  // Why only the extension asks: docs/architecture/deploy.md, "The extension".
  askForServer?: "never" | "always" | "onRequest";
  initialServerUrl?: string | null;
  note: string | null;
  aboveSubmit?: ReactNode;
  switchLink?: ReactNode;
  sending: boolean;
  refused: string | null;
  onSubmit: (values: EmailLinkFormValues) => void;
  // Onboarding's account step: no name hint, a full-width button, the note led by a tick.
  onboarding?: boolean;
}

export const EmailLinkForm = ({
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
  onboarding = false,
}: EmailLinkFormProps) => {
  const analytics = useAnalytics();
  const isPanel = useIsPanel();
  const isPhone = useIsPhone();
  const footed = isPanel || isPhone;
  const ids = useId();
  const [email, setEmail] = useState(initialEmail);
  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [serverUrl, setServerUrl] = useState(initialServerUrl ?? "");
  const [serverShown, setServerShown] = useState(askForServer === "always");
  const [problem, setProblem] = useState<{ field: "email" | "server"; message: string } | null>(null);
  const creating = intent === "createAccount";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // A blank name is no name, not a problem; the input's maxLength keeps a given one inside FirstName.
    const name = FirstName.safeParse(firstName);
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

  const messageFor = (field: "email" | "server") => {
    if (problem?.field === field) {
      return problem.message;
    }
    return field === "email" ? refused : null;
  };

  const errorFor = (field: "email" | "server") => {
    const message = messageFor(field);
    return message === null ? null : (
      <span className={styles.error} id={`${ids}-${field}-error`} data-testid={emailLinkFormTestIds.fieldError}>
        <StrokeIcon name="alertCircle" size={14} />
        {message}
      </span>
    );
  };

  const describedBy = (field: "email" | "server") => (errorFor(field) === null ? undefined : `${ids}-${field}-error`);

  const button = (
    <button type="submit" className={styles.submit} disabled={sending} data-testid={emailLinkFormTestIds.submitButton}>
      {submitLabel}
    </button>
  );
  const [noteLead, ...noteRest] = note === null ? [] : note.split(/(?<=\.) /);
  const noteParagraph = () => {
    if (note === null) {
      return null;
    }
    if (onboarding) {
      return (
        <p className={styles.noteTicked} data-testid={emailLinkFormTestIds.savedOverviewsNote}>
          <StrokeIcon name="check" size={15} />
          <span>
            <strong>{noteLead}</strong> {noteRest.join(" ")}
          </span>
        </p>
      );
    }
    return (
      <p className={styles.note} data-testid={emailLinkFormTestIds.savedOverviewsNote}>
        {note}
      </p>
    );
  };
  const noteLine = noteParagraph();
  const switchLine =
    switchLink === undefined ? null : (
      <p className={styles.switch} data-testid={emailLinkFormTestIds.switchLine}>
        {switchLink}
      </p>
    );

  return (
    <form
      className={`${styles.root} ${footed ? styles.footed : ""} ${onboarding ? styles.onboarding : ""}`}
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
              <span className={styles.labelText}>First name (optional)</span>
              {!footed && !onboarding && <span className={styles.labelHint}>So we know what to call you</span>}
            </span>
            <span className={styles.field}>
              <StrokeIcon name="user" size={16} />
              <input
                id={`${ids}-given-name`}
                name="given-name"
                className={styles.input}
                type="text"
                autoComplete="given-name"
                value={firstName}
                maxLength={FIRST_NAME_MAX_LENGTH}
                onChange={(event) => setFirstName(event.target.value)}
                data-testid={emailLinkFormTestIds.firstNameInput}
              />
            </span>
          </label>
        )}
        <label className={styles.label}>
          <span className={styles.labelText}>Email</span>
          <span className={`${styles.field} ${problem?.field === "email" || refused !== null ? styles.fieldInvalid : ""}`}>
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
};
