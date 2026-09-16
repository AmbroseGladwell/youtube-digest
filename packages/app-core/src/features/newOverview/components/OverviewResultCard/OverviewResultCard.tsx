import type { ReactNode } from "react";
import type { Overview } from "@overview/types";
import styles from "./OverviewResultCard.module.scss";
import { overviewResultCardTestIds } from "./OverviewResultCardTestIds.js";
import { formatTimeRange } from "../../util/formatTimeRange.js";
import { youtubeTimestampUrl } from "../../util/youtubeTimestampUrl.js";
import { NOVELTY_LABEL } from "../../../overviews/noveltyLabel.js";

export interface OverviewResultCardProps {
  overview: Overview;
}

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
      <header className={styles.head}>
        <p className={styles.kickerRow}>
          <span className={styles.channel}>{overview.video.channel}</span>
          {overview.verdict && (
            <span
              className={`${styles.verdict} ${overview.verdict.novelty === "novel" ? styles.verdictNovel : ""}`}
              data-testid={overviewResultCardTestIds.verdictBadge}
            >
              {NOVELTY_LABEL[overview.verdict.novelty]}
            </span>
          )}
          {overview.verdict?.dubious && (
            <span className={styles.dubious} data-testid={overviewResultCardTestIds.dubiousFlag}>
              ⚠ Dubious claim
            </span>
          )}
        </p>
        <h2 className={styles.title} data-testid={overviewResultCardTestIds.title}>
          {overview.video.title}
        </h2>
        <a className={styles.watchLink} href={overview.video.url} target="_blank" rel="noopener">
          Watch on YouTube
        </a>
      </header>

      <Section label="In one line">
        <p className={styles.prose}>{overview.inOneLine}</p>
      </Section>

      <Section label={overview.thin ? "No clear claim" : "Core claim"}>
        <p className={styles.prose}>{overview.coreClaim}</p>
      </Section>

      {overview.verdict && (
        <Section label="Verdict">
          <p className={styles.prose}>{overview.verdict.reasoning}</p>
        </Section>
      )}

      <Section label="Key points">
        <ul className={styles.points}>
          {overview.keyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </Section>

      {overview.howToApply && overview.howToApply.items.length > 0 && (
        <Section label="How to apply">
          <ul className={styles.points}>
            {overview.howToApply.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
      )}

      {overview.selling && overview.selling.type !== "none" && (
        <Section label="What it sells">
          <p className={styles.prose} data-testid={overviewResultCardTestIds.sellingChip}>
            {SELLING_LABEL[overview.selling.type]}
          </p>
        </Section>
      )}

      {overview.watchAnyway && (
        <Section label="Watch it anyway?">
          <p className={styles.prose} data-testid={overviewResultCardTestIds.watchAnywayBadge}>
            {WATCH_LABEL[overview.watchAnyway.answer]}. {overview.watchAnyway.reason}
          </p>
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
        </Section>
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

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <p className={styles.sectionLabel}>{label}</p>
      {children}
    </section>
  );
}
