import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./ConsentAddressCard.module.scss";
import { consentAddressCardTestIds } from "./ConsentAddressCardTestIds.js";

export interface ConsentAddressCardProps {
  host: string;
}

// The one thing on the screen the assistant cannot make up, so it outranks the name
// (design 58a).
export function ConsentAddressCard({ host }: ConsentAddressCardProps) {
  return (
    <div className={styles.root} data-testid={consentAddressCardTestIds.root}>
      <div className={styles.address}>
        <span className={styles.badge}>
          <StrokeIcon name="link" size={20} />
        </span>
        <span className={styles.lines}>
          <span className={styles.lead}>Approving sends you back to</span>
          <span className={styles.host} data-testid={consentAddressCardTestIds.host}>
            {host}
          </span>
        </span>
      </div>
      <p className={styles.note}>
        The one detail the assistant can’t make up. If you weren’t just using {host}, decline.
      </p>
    </div>
  );
}
