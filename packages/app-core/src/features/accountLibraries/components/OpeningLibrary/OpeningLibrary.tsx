import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./OpeningLibrary.module.scss";
import { openingLibraryTestIds } from "./OpeningLibraryTestIds.js";

const CARDS = 3;
const RAIL = ["40%", "80%", "70%", null, "40%", "85%", "60%", "65%"];

// Design 47f: after a sign-in only, until the account's first cycle is done, so an empty
// library is never mistaken for the account's (docs/features/account-libraries.md).
export function OpeningLibrary({ panel = false }: { panel?: boolean }) {
  const status = (
    <p className={styles.status} role="status" aria-live="polite" data-testid={openingLibraryTestIds.status}>
      <span className={styles.spinner}>
        <StrokeIcon name="loader" size={panel ? 16 : 19} />
      </span>
      Opening your library…
    </p>
  );

  if (panel) {
    return (
      <div className={styles.panel} aria-busy="true" data-testid={openingLibraryTestIds.root}>
        <span className={styles.bar} style={{ width: "80%", height: "1rem" }} />
        <span className={styles.bar} style={{ width: "45%" }} />
        {status}
      </div>
    );
  }

  return (
    <div className={styles.root} aria-busy="true" data-testid={openingLibraryTestIds.root}>
      <aside className={styles.rail} aria-hidden="true">
        {RAIL.map((width, index) =>
          width === null ? (
            <span key={index} className={styles.railGap} />
          ) : (
            <span key={index} className={index === 0 || index === 4 ? styles.bar : styles.pill} style={{ width }} />
          ),
        )}
      </aside>
      <div className={styles.main}>
        {status}
        {Array.from({ length: CARDS }, (_, index) => (
          <div key={index} className={styles.card} aria-hidden="true">
            <span className={styles.thumb} />
            <span className={styles.lines}>
              <span className={styles.bar} style={{ width: "22%" }} />
              <span className={styles.bar} style={{ width: "70%", height: "1rem" }} />
              <span className={styles.bar} style={{ width: "90%" }} />
              <span className={styles.bar} style={{ width: "40%" }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
