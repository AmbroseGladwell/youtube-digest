import type { Ref } from "react";
import type { Sample } from "@overview/domain";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { sampleFacts } from "../../util/sampleFacts.js";
import styles from "./SampleRow.module.scss";
import { sampleRowTestIds } from "./SampleRowTestIds.js";

export interface SampleRowProps {
  sample: Sample;
  opening: boolean;
  onOpen: () => void;
  ref?: Ref<HTMLButtonElement>;
}

export const SampleRow = ({ sample, opening, onOpen, ref }: SampleRowProps) => {
  const facts = sampleFacts(sample.note);
  return (
    <button
      ref={ref}
      type="button"
      className={styles.root}
      aria-label={facts.name}
      aria-busy={opening || undefined}
      onClick={onOpen}
      data-testid={sampleRowTestIds.root}
    >
      <OverviewThumbnail video={sample.note.source} className={styles.thumb} />
      <span className={styles.meta}>
        <span className={styles.kicker}>
          {facts.source} · {facts.kindLabel}
        </span>
        <span className={styles.title}>{sample.note.source.title}</span>
        {opening ? (
          <span className={styles.opening} data-testid={sampleRowTestIds.opening}>
            <StrokeIcon name="loader" size={14} />
            Opening…
          </span>
        ) : (
          facts.length !== null && <span className={styles.length}>{facts.length}</span>
        )}
      </span>
    </button>
  );
};
