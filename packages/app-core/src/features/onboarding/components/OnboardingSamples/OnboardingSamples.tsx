import { useEffect, useId, useRef, useState } from "react";
import type { Sample } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useStartFromSample } from "../../useStartFromSample.js";
import { SampleRow } from "../SampleRow/SampleRow.js";
import styles from "./OnboardingSamples.module.scss";
import { onboardingSamplesTestIds } from "./OnboardingSamplesTestIds.js";

const SHOWN_AT_FIRST = 3;

export const SAMPLE_FAILED = "That sample couldn't be opened. Try another, or paste a link.";

// Design 155d: Start's samples as rows, three at a time, under what the panel is beside. More
// samples opens the rest in place and moves focus to the first of them; nothing scrolls sideways
// (docs/features/onboarding.md, "Try a sample").
export function OnboardingSamples({ samples }: { samples: readonly Sample[] }) {
  const headingId = useId();
  const { opening, failed, open } = useStartFromSample();
  const [all, setAll] = useState(false);
  const rows = useRef<Array<HTMLButtonElement | null>>([]);
  const pressed = useRef<number | null>(null);
  const firstMore = useRef(false);
  const shown = all ? samples : samples.slice(0, SHOWN_AT_FIRST);

  useEffect(() => {
    if (failed && pressed.current !== null) rows.current[pressed.current]?.focus();
  }, [failed]);
  useEffect(() => {
    if (all && firstMore.current) rows.current[SHOWN_AT_FIRST]?.focus();
    firstMore.current = false;
  }, [all]);

  return (
    <section className={styles.root} aria-labelledby={headingId} data-testid={onboardingSamplesTestIds.root}>
      <h2 id={headingId} className={styles.heading}>
        Or try a sample
      </h2>
      {failed && (
        <p className={styles.failed} role="alert" data-testid={onboardingSamplesTestIds.failed}>
          <StrokeIcon name="alert" size={15} />
          {SAMPLE_FAILED}
        </p>
      )}
      <div className={styles.rows} role="group" aria-labelledby={headingId}>
        {shown.map((sample, index) => (
          <SampleRow
            key={sample.token}
            ref={(row) => {
              rows.current[index] = row;
            }}
            sample={sample}
            opening={opening === sample.token}
            onOpen={() => {
              pressed.current = index;
              void open(sample, index);
            }}
          />
        ))}
      </div>
      {samples.length > SHOWN_AT_FIRST && (
        <button
          type="button"
          className={styles.more}
          aria-expanded={all}
          onClick={() => {
            firstMore.current = !all;
            setAll(!all);
          }}
          data-testid={onboardingSamplesTestIds.more}
        >
          {all ? "Fewer samples" : "More samples"}
          <StrokeIcon name={all ? "chevronUp" : "chevronDown"} size={14} />
        </button>
      )}
    </section>
  );
}
