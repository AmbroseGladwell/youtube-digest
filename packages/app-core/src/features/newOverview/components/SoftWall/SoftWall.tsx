import { useEffect, useRef } from "react";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { GET_OVERVIEW_PLUS } from "../../../plus/components/GetPlusButton/GetPlusButton.js";
import { PAID_PRICES, PLAN_CARDS } from "../../../plus/planCards.js";
import styles from "./SoftWall.module.scss";
import { softWallTestIds } from "./SoftWallTestIds.js";

const PLUS = PLAN_CARDS.find((card) => card.name === "Plus")!;
const FREE = PLAN_CARDS.find((card) => card.name === "Free")!;

export interface SoftWallProps {
  // Never more than the link itself costs to know.
  link: { kicker: string | null; title: string };
  resetsOn: string;
  offerKey: boolean;
  onSeePlans: () => void;
  onFollowed: () => void;
  // Absent once the month's saves are made: docs/features/kept-links.md, "The save limit".
  save?: SaveForNow | undefined;
}

export interface SaveForNow {
  overviewsBack: string;
  savesLeft: number;
  savesLimit: number;
  saving: boolean;
  onSave: () => void;
}

const SAVES_SHOWN_FROM = 10;

// Soft: everything they've saved keeps working, and the link stays where it was.
export const SoftWall = ({ link, resetsOn, offerKey, onSeePlans, onFollowed, save }: SoftWallProps) => {
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className={styles.root} aria-labelledby="soft-wall-heading" data-testid={softWallTestIds.root}>
      <h2 id="soft-wall-heading" ref={heading} tabIndex={-1} className={styles.title}>
        You’ve hit your overview limit.
      </h2>
      <p className={styles.lead}>
        Your overview limit resets on {resetsOn}. Everything you’ve saved keeps working. Read, listen, search, and ask your AI.
      </p>

      <div className={styles.card} data-testid={softWallTestIds.link}>
        <span className={styles.label}>The link you pasted</span>
        {link.kicker !== null && <span className={styles.kicker}>{link.kicker}</span>}
        <span className={styles.linkTitle}>{link.title}</span>
      </div>

      <div className={styles.way}>
        <div>
          <span className={styles.wayName}>Plus</span>
          <p className={styles.wayBody}>
            {PLUS.ourKey.replace(" a month", "")} overviews a month on us, and {PLUS.ownKey.replace(" a month", "")} on your own AI API key.
            From {PAID_PRICES.plus.yearlyPerMonth} a month, cancel anytime.
          </p>
        </div>
        <button type="button" className={styles.primary} onClick={onSeePlans} data-testid={softWallTestIds.getPlus}>
          <StrokeIcon name="gem" size={15} weight={1.8} />
          {GET_OVERVIEW_PLUS}
        </button>
      </div>

      {save !== undefined && (
        <div className={styles.way} data-testid={softWallTestIds.wait}>
          <div>
            <span className={styles.wayName}>Wait for {resetsOn}</span>
            <p className={styles.wayBody}>
              Save it now with its transcript, and make its overview when your {save.overviewsBack} are back.
              {save.savesLeft <= SAVES_SHOWN_FROM && (
                <>
                  {" "}
                  <strong data-testid={softWallTestIds.savesLeft}>
                    {save.savesLeft} of {save.savesLimit} saves left this month.
                  </strong>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            className={styles.secondary}
            onClick={save.onSave}
            disabled={save.saving}
            aria-busy={save.saving}
            data-testid={softWallTestIds.saveForNow}
          >
            {save.saving ? "Saving…" : "Save it for now"}
          </button>
        </div>
      )}

      <p className={styles.foot}>
        <button type="button" className={styles.link} onClick={onSeePlans} data-testid={softWallTestIds.seePlans}>
          See every plan
        </button>
        {offerKey && (
          <>
            {" · "}Have an AI API key? Free includes {FREE.ownKey} on it.{" "}
            <PageLink to={Routes.settingsSection("keys")} onClick={onFollowed} data-testid={softWallTestIds.addKey}>
              Add it in Settings
            </PageLink>
          </>
        )}
      </p>
    </section>
  );
};
