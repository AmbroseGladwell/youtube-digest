import { useId, useMemo, useState } from "react";
import type { Sample } from "@overview/domain";
import { savedFromShare } from "../../../sharedPage/util/savedFromShare.js";
import { onboardingSources } from "../../onboardingSources.js";
import { useSamplesQuery } from "../../queries/samplesQuery.js";
import { useStartFromSample } from "../../useStartFromSample.js";
import styles from "./OnboardingSamples.module.scss";
import { onboardingSamplesTestIds } from "./OnboardingSamplesTestIds.js";

// Start's other way in, beside the link field: a few ready-made overviews, one tap each, so a
// new reader never has to leave to find a link. Plain until the Claude Design round draws them;
// with no samples to offer, nothing is shown (docs/features/onboarding.md, "Try a sample").
export function OnboardingSamples() {
  const samples = useSamplesQuery();
  const startFromSample = useStartFromSample();
  const headingId = useId();
  const [opening, setOpening] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const bylines = useMemo(
    () =>
      (samples.data ?? []).map(({ note }) => onboardingSources[note.source.kind].teaser(savedFromShare(note)).byline),
    [samples.data],
  );

  if (!samples.isSuccess || samples.data.length === 0) return null;

  const choose = async (sample: Sample, index: number) => {
    setOpening(sample.token);
    setFailed(false);
    const opened = await startFromSample(sample, index);
    setOpening(null);
    setFailed(!opened);
  };

  return (
    <section className={styles.root} aria-labelledby={headingId} data-testid={onboardingSamplesTestIds.root}>
      <h3 id={headingId} className={styles.heading}>
        Or try a sample
      </h3>
      <ul className={styles.list} role="group" aria-labelledby={headingId}>
        {samples.data.map((sample, index) => (
          <li key={sample.token}>
            <button
              type="button"
              className={styles.sample}
              disabled={opening !== null}
              aria-busy={opening === sample.token}
              onClick={() => void choose(sample, index)}
              data-testid={onboardingSamplesTestIds.sample}
            >
              <span className={styles.title}>{sample.note.source.title}</span>
              <span className={styles.byline}>{bylines[index]}</span>
            </button>
          </li>
        ))}
      </ul>
      {failed && (
        <p className={styles.failed} role="alert" data-testid={onboardingSamplesTestIds.failed}>
          That sample couldn't be opened. Try another, or paste a link.
        </p>
      )}
    </section>
  );
}
