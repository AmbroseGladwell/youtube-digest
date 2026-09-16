import type { Overview } from "@overview/types";
import styles from "./OverviewResultCard.module.scss";
import { overviewResultCardTestIds } from "./OverviewResultCardTestIds.js";
import { formatTimeRange } from "../../util/formatTimeRange.js";
import { youtubeTimestampUrl } from "../../util/youtubeTimestampUrl.js";
import { NOVELTY_LABEL } from "../../../overviews/noveltyLabel.js";

export interface OverviewResultCardProps {
  overview: Overview;
}

const NOVELTY_BADGE_CLASS: Record<string, string | undefined> = {
  novel: styles.badgeNovel,
  competent_not_new: styles.badgeCompetent,
  recycled: styles.badgeRecycled,
};

const SELLING_LABEL: Record<string, string> = {
  own_paid_product: "Sells their own paid product",
  own_free_promotion: "Promotes something of theirs, free",
  sponsor_or_affiliate: "Sponsored or affiliate",
  none: "Sells nothing",
};

const WATCH_LABEL: Record<string, string> = {
  yes: "Worth watching anyway",
  no: "Skip the video, the overview covers it",
  partial: "Worth watching one part",
};

export function OverviewResultCard({ overview }: OverviewResultCardProps) {
  return (
    <article className={styles.root} data-testid={overviewResultCardTestIds.root}>
      <p className={styles.eyebrow}>{overview.video.channel}</p>
      <h2 className={styles.title} data-testid={overviewResultCardTestIds.title}>
        {overview.video.title}
      </h2>
      <a className={styles.watchLink} href={overview.video.url} target="_blank" rel="noopener">
        Watch on YouTube
      </a>

      {((overview.selling && overview.selling.type !== "none") || overview.watchAnyway) && (
        <div className={styles.badgeRow}>
          {overview.selling && overview.selling.type !== "none" && (
            <span
              className={`${styles.badge} ${styles.badgeCompetent}`}
              data-testid={overviewResultCardTestIds.sellingChip}
            >
              {SELLING_LABEL[overview.selling.type]}
            </span>
          )}
          {overview.watchAnyway && (
            <span
              className={`${styles.badge} ${styles.badgeCompetent}`}
              data-testid={overviewResultCardTestIds.watchAnywayBadge}
            >
              {WATCH_LABEL[overview.watchAnyway.answer]}
            </span>
          )}
        </div>
      )}

      <div className={styles.section}>
        <p className={styles.sectionHeading}>In one line</p>
        <p className={styles.coreClaim}>{overview.inOneLine}</p>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionHeading}>{overview.thin ? "No clear claim" : "Core claim"}</p>
        <p className={styles.coreClaim}>{overview.coreClaim}</p>
      </div>

      {overview.verdict && (
        <div className={styles.section}>
          <p className={styles.sectionHeading}>Verdict</p>
          <div
            className={`${styles.verdictBlock} ${overview.verdict.dubious ? styles.verdictBlockDubious : ""}`}
          >
            <div className={styles.verdictHeadRow}>
              <span
                className={`${styles.badge} ${NOVELTY_BADGE_CLASS[overview.verdict.novelty]}`}
                data-testid={overviewResultCardTestIds.verdictBadge}
              >
                {NOVELTY_LABEL[overview.verdict.novelty]}
              </span>
              {overview.verdict.dubious && (
                <span
                  className={styles.dubiousFlag}
                  data-testid={overviewResultCardTestIds.dubiousFlag}
                >
                  ⚠ Dubious claim
                </span>
              )}
            </div>
            <p className={styles.reasoning}>{overview.verdict.reasoning}</p>
          </div>
        </div>
      )}

      <div className={styles.section}>
        <p className={styles.sectionHeading}>Key points</p>
        <ul className={styles.keyPoints}>
          {overview.keyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>

      {overview.howToApply && overview.howToApply.items.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionHeading}>How to apply</p>
          <ul className={styles.keyPoints}>
            {overview.howToApply.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {overview.watchAnyway && (
        <div className={styles.section}>
          <p className={styles.sectionHeading}>Watch it anyway?</p>
          <p className={styles.reasoning}>{overview.watchAnyway.reason}</p>
          {overview.watchAnyway.range && (
            <a
              className={styles.rangeLink}
              href={youtubeTimestampUrl(overview.video.url, overview.watchAnyway.range.startMs)}
              target="_blank"
              rel="noopener"
              data-testid={overviewResultCardTestIds.watchAnywayRangeLink}
            >
              Jump to{" "}
              {formatTimeRange(overview.watchAnyway.range.startMs, overview.watchAnyway.range.endMs)}
            </a>
          )}
        </div>
      )}

      <div className={styles.tagRow}>
        {overview.tags.map((tag) => (
          <span key={tag} className={styles.tag}>
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}
