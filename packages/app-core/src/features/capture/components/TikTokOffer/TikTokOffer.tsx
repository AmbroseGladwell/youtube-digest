import { TikTokCard } from "../../../newOverview/components/TikTokLinkStatus/TikTokLinkStatus.js";
import { ArticleFailureNotice } from "../ArticleFailureNotice/ArticleFailureNotice.js";
import type { TikTokTab } from "../../useTikTokTab.js";
import styles from "./TikTokOffer.module.scss";
import { tiktokOfferTestIds } from "./TikTokOfferTestIds.js";

export interface TikTokOfferProps {
  tab: TikTokTab;
  ready: boolean;
  onMake: () => void;
}

// Designs 130i, 130i-2: "On this tab", the TikTok, and the one way on.
export const TikTokOffer = ({ tab, ready, onMake }: TikTokOfferProps) => {
  const { state } = tab;
  const video = "video" in state ? state.video : null;
  return (
    <section className={styles.root} aria-label="On this tab" data-testid={tiktokOfferTestIds.card}>
      <p className={styles.label}>On this tab</p>
      {video === null ? (
        <div className={styles.light}>
          <span className={styles.lightCover} aria-hidden="true" />
          <span className={styles.lightWords}>
            <span className={styles.kicker}>TikTok</span>
            <span className={styles.lightTitle} data-testid={tiktokOfferTestIds.tabTitle}>
              {tab.title === "" ? "A TikTok video" : tab.title}
            </span>
          </span>
        </div>
      ) : (
        <TikTokCard video={video} tinted />
      )}
      {state.status === "stopped" ? (
        <ArticleFailureNotice copy={state.copy} onWay={onMake} />
      ) : (
        <button
          type="button"
          className={styles.make}
          onClick={onMake}
          disabled={!ready || state.status === "reading"}
          data-testid={tiktokOfferTestIds.makeButton}
        >
          {state.status === "reading" ? "Reading the TikTok…" : "Make an overview of this TikTok"}
        </button>
      )}
    </section>
  );
};
