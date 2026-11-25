import { useState } from "react";
import styles from "./KeepForExtension.module.scss";
import { keepForExtensionTestIds } from "./KeepForExtensionTestIds.js";

export interface KeepForExtensionProps {
  onKeep: () => Promise<void>;
}

// Under a stop only the extension can get past, on the web or a phone (docs/features/kept-links.md, "Only the extension can read").
export const KeepForExtension = ({ onKeep }: KeepForExtensionProps) => {
  const [kept, setKept] = useState(false);
  if (kept) {
    return (
      <p className={styles.kept} role="status" data-testid={keepForExtensionTestIds.kept}>
        <b>Kept.</b> It’s made the next time the extension is open on a computer.
      </p>
    );
  }
  return (
    <p className={styles.root} data-testid={keepForExtensionTestIds.root}>
      <button
        type="button"
        className={styles.keep}
        onClick={() => void onKeep().then(() => setKept(true))}
        aria-label="Keep it: made in the extension on a computer"
        data-testid={keepForExtensionTestIds.keep}
      >
        Keep it
      </button>
      <span>and it’s made the next time the extension is open on a computer.</span>
    </p>
  );
};
