import { useEffect, useState } from "react";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { resetDate } from "../../../newOverview/util/usageLine.js";
import { chatUpsellLabel, type ChatMeter } from "../../util/chatMeterOf.js";
import styles from "./ChatMeterLine.module.scss";
import { chatMeterLineTestIds } from "./ChatMeterLineTestIds.js";

export interface ChatMeterLineProps {
  meter: ChatMeter;
  onPlansFollowed: () => void;
}

// Design 376b–376c: one quiet line under the field, the warning announced once, the bar hidden from assistive tech.
export const ChatMeterLine = ({ meter, onPlansFollowed }: ChatMeterLineProps) => {
  const { percent, warning, resetsOn, upsell } = meter;
  const text = `${percent}% of chat used · Resets ${resetDate(resetsOn)}`;
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (warning) {
      setAnnouncement((said) => (said === "" ? text : said));
    }
  }, [warning, text]);

  return (
    <>
      <p className={warning ? `${styles.root} ${styles.warning}` : styles.root} data-testid={chatMeterLineTestIds.root}>
        <span className={styles.bar} aria-hidden="true">
          <b style={{ width: `${percent}%` }} />
        </span>
        <span data-testid={chatMeterLineTestIds.text}>
          {text}
          {upsell !== null && (
            <>
              {" · "}
              <PageLink
                className={styles.plans}
                to={Routes.settingsSection("plan")}
                onClick={onPlansFollowed}
                data-testid={chatMeterLineTestIds.plans}
              >
                {chatUpsellLabel(upsell)}
              </PageLink>
            </>
          )}
        </span>
      </p>
      <span className={styles.live} aria-live="polite" data-testid={chatMeterLineTestIds.announcement}>
        {announcement}
      </span>
    </>
  );
};
