import { modelFor, modelLabel, PROVIDER_LABEL, PROVIDER_SHORT_LABEL, type ModelByProvider, type Provider } from "@overview/domain";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { addKeyLabel, deviceWord, sentenceCase, useInsteadLabel } from "../../../apiKeys/keyPrompt.js";
import styles from "./GenerateWithCard.module.scss";
import { generateWithCardTestIds } from "./GenerateWithCardTestIds.js";

export interface GenerateWithCardProps {
  provider: Provider;
  models: ModelByProvider;
  // The providers this device holds a key for, most recently chosen first is not needed:
  // the order is the list's own.
  held: Provider[];
  onChoose: (provider: Provider) => void;
  onAddKeyFor: (provider: Provider) => void;
}

const pairLabel = (provider: Provider, models: ModelByProvider) =>
  `${PROVIDER_LABEL[provider]} · ${modelLabel(provider, modelFor(models, provider))}`;

// What generation runs on, above the list rather than marked inside it, so that the split
// the feature introduces is visible: the choice follows the reader between devices and the
// keys do not (design 110b, Q2).
export function GenerateWithCard({ provider, models, held, onChoose, onAddKeyFor }: GenerateWithCardProps) {
  const surface = useSurface();
  const here = deviceWord(surface, useIsPhone());
  const hasKeyHere = held.includes(provider);
  const fallback = held.find((candidate) => candidate !== provider) ?? null;

  return (
    <section className={styles.root} data-testid={generateWithCardTestIds.root}>
      <p className={styles.label}>Generate with</p>

      {held.length > 1 && hasKeyHere ? (
        <select
          className={styles.select}
          aria-label="Generate with"
          value={provider}
          onChange={(event) => onChoose(event.target.value as Provider)}
          data-testid={generateWithCardTestIds.select}
        >
          {held.map((candidate) => (
            <option key={candidate} value={candidate}>
              {pairLabel(candidate, models)}
            </option>
          ))}
        </select>
      ) : (
        // With one key the choice is a plain line, not a control: there is nothing to
        // choose between (design 110b).
        <p className={styles.choice} data-testid={generateWithCardTestIds.choice}>
          {pairLabel(provider, models)}
        </p>
      )}

      {hasKeyHere ? (
        <p className={styles.note} data-testid={generateWithCardTestIds.asymmetryNote}>
          Your choice follows you to every device you sign in on. Keys don’t: each device holds its own.
        </p>
      ) : (
        <>
          <p className={styles.missing} data-testid={generateWithCardTestIds.missingHeading}>
            {sentenceCase(here)} has no {PROVIDER_SHORT_LABEL[provider]} key.
          </p>
          <p className={styles.note}>
            You chose {PROVIDER_SHORT_LABEL[provider]} on another device, and keys stay on the device they were
            added on for security. Add the key here too, or generate with a key {here} already has.
          </p>
          <div className={styles.ways}>
            {/* Focus lands on the first, which is the way out that keeps the reader's
                choice rather than changing it everywhere (design 110g). */}
            <button
              type="button"
              className={styles.addKey}
              autoFocus
              onClick={() => onAddKeyFor(provider)}
              data-testid={generateWithCardTestIds.addKey}
            >
              {addKeyLabel(provider)}
            </button>
            {/* Hidden rather than disabled when there is no other key here: a control that
                cannot work is worse than no control (docs/prototype/decisions.md). */}
            {fallback !== null && (
              <button
                type="button"
                className={styles.useFallback}
                onClick={() => onChoose(fallback)}
                data-testid={generateWithCardTestIds.useFallback}
              >
                {useInsteadLabel(fallback)}
              </button>
            )}
          </div>
          {fallback !== null && (
            <p className={styles.footnote} data-testid={generateWithCardTestIds.footnote}>
              Using {PROVIDER_SHORT_LABEL[fallback]} changes the choice on every device.
            </p>
          )}
        </>
      )}
    </section>
  );
}
