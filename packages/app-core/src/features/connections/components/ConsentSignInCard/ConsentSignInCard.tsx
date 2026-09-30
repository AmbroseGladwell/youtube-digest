import { EmailLinkForm } from "../../../auth/components/EmailLinkForm/EmailLinkForm.js";
import styles from "./ConsentSignInCard.module.scss";
import { consentSignInCardTestIds } from "./ConsentSignInCardTestIds.js";

export interface ConsentSignInCardProps {
  initialEmail: string;
  sending: boolean;
  refused: string | null;
  onSubmit: (email: string) => void;
}

// Signed out, the request stays in view and the permissions wait: the link asked for here
// comes back to this request (design 58d).
export function ConsentSignInCard({ initialEmail, sending, refused, onSubmit }: ConsentSignInCardProps) {
  return (
    <div className={styles.root} data-testid={consentSignInCardTestIds.root}>
      <p className={styles.label}>Sign in to answer</p>
      <EmailLinkForm
        intent="signIn"
        submitLabel="Email me a link"
        initialEmail={initialEmail}
        note="The link brings you back to this request. No account yet? The same link makes one."
        sending={sending}
        refused={refused}
        onSubmit={({ email }) => onSubmit(email)}
      />
    </div>
  );
}
