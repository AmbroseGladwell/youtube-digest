import { AuthScreen } from "../AuthScreen/AuthScreen.js";
import styles from "./SignedInWelcome.module.scss";
import { signedInWelcomeTestIds } from "./SignedInWelcomeTestIds.js";

export interface SignedInWelcomeProps {
  firstName: string | null;
  overviewCount: number;
  onDone: () => void;
}

const syncingLine = (count: number): string =>
  count === 0
    ? "Overviews you make here will sync to your account, and be on the web app and your phone too."
    : `The ${count === 1 ? "overview" : `${count} overviews`} in the extension ${count === 1 ? "is" : "are"} syncing to your account. They'll be on the web app and your phone in a moment.`;

// Design 10e: the panel's one moment of saying the code worked.
export function SignedInWelcome({ firstName, overviewCount, onDone }: SignedInWelcomeProps) {
  return (
    <AuthScreen
      testId={signedInWelcomeTestIds.root}
      icon="check"
      title={firstName === null ? "You're in" : `You're in, ${firstName}`}
      lead={syncingLine(overviewCount)}
    >
      <div className={styles.footer}>
        <button type="button" className={styles.done} onClick={onDone} data-testid={signedInWelcomeTestIds.doneButton}>
          Done
        </button>
      </div>
    </AuthScreen>
  );
}
