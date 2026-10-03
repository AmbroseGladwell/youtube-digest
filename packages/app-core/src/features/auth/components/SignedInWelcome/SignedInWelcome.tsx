import type { LibraryMove } from "../../../accountLibraries/types/LibraryMove.js";
import { libraryMoveCopy } from "../../../accountLibraries/util/libraryMoveCopy.js";
import { AuthScreen } from "../AuthScreen/AuthScreen.js";
import styles from "./SignedInWelcome.module.scss";
import { signedInWelcomeTestIds } from "./SignedInWelcomeTestIds.js";

export interface SignedInWelcomeProps {
  firstName: string | null;
  // What signing in moved into the account, once the move has run (design 47e).
  move: LibraryMove | null;
  onDone: () => void;
}

const SYNCING_LINE = "Overviews you make here will sync to your account, and be on the web app and your phone too.";

// Design 10e: the panel's one moment of saying the code worked, and 47e's place in the
// extension for saying what came into the account with it.
export function SignedInWelcome({ firstName, move, onDone }: SignedInWelcomeProps) {
  const copy = move === null ? null : libraryMoveCopy(move);
  return (
    <AuthScreen
      testId={signedInWelcomeTestIds.root}
      icon="check"
      title={firstName === null ? "You're in" : `You're in, ${firstName}`}
      lead={copy?.lead ?? SYNCING_LINE}
    >
      {copy?.then != null && (
        <p className={styles.then} data-testid={signedInWelcomeTestIds.movedThen}>
          {copy.then}
        </p>
      )}
      <div className={styles.footer}>
        <button type="button" className={styles.done} onClick={onDone} data-testid={signedInWelcomeTestIds.doneButton}>
          Done
        </button>
      </div>
    </AuthScreen>
  );
}
