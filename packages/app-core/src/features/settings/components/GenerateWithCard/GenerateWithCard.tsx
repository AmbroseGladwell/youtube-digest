import { modelFor, modelLabel, PROVIDER_LABEL, PROVIDER_SHORT_LABEL, type ModelByProvider, type Provider } from "@overview/domain";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { addKeyLabel, deviceWord, sentenceCase, useInsteadLabel } from "../../../apiKeys/keyPrompt.js";
import styles from "./GenerateWithCard.module.scss";
import { generateWithCardTestIds } from "./GenerateWithCardTestIds.js";

export interface GenerateWithCardProps {
  provider: Provider;
  models: ModelByProvider;
  held: Provider[];
  onChoose: (provider: Provider) => void;
  onAddKeyFor: (provider: Provider) => void;
}

const pairLabel = (provider: Provider, models: ModelByProvider) =>
  `${PROVIDER_LABEL[provider]} · ${modelLabel(provider, modelFor(models, provider))}`;

// Above the list, not marked in it, to show the choice follows the reader between devices and keys don't.
export const GenerateWithCard = ({ provider, models, held, onChoose, onAddKeyFor }: GenerateWithCardProps) => {
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
            You chose {PROVIDER_SHORT_LABEL[provider]} on another device, and keys stay on the device they were added on for security. Add
            the key here too, or generate with a key {here} already has.
          </p>
          <div className={styles.ways}>
            {/* Focus lands on the way out that keeps the reader's choice, not the one changing it everywhere. */}
            <button
              type="button"
              className={styles.addKey}
              autoFocus
              onClick={() => onAddKeyFor(provider)}
              data-testid={generateWithCardTestIds.addKey}
            >
              {addKeyLabel(provider)}
            </button>
            {/* Hidden rather than disabled with no other key here (CLAUDE.md, "degrade visibly"). */}
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
};
