import { useEffect, useRef } from "react";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { PLAN_CARDS } from "../../../plus/planCards.js";
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
}

// Soft: everything they've saved keeps working, and the link stays where it was.
export const SoftWall = ({ link, resetsOn, offerKey, onSeePlans, onFollowed }: SoftWallProps) => {
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
            {PLUS.ourKey.replace(" a month", "")} overviews a month on us, and {PLUS.ownKey.replace(" a month", "")} on your own AI API key.{" "}
            {PLUS.price}, cancel anytime.
          </p>
        </div>
        <button type="button" className={styles.primary} onClick={onSeePlans} data-testid={softWallTestIds.getPlus}>
          Get Plus
        </button>
      </div>

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
