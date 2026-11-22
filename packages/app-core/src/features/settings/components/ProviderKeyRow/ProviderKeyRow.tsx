import { useState } from "react";
import { modelFor, modelLabel, PROVIDER_LABEL, PROVIDER_SHORT_LABEL, type ModelByProvider, type Provider } from "@overview/domain";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { keyEnding, type StoredKey } from "../../../apiKeys/ApiKeys.js";
import { deviceWord } from "../../../apiKeys/keyPrompt.js";
import styles from "./ProviderKeyRow.module.scss";
import { providerKeyRowTestIds } from "./ProviderKeyRowTestIds.js";

export interface ProviderKeyRowProps {
  provider: Provider;
  stored: StoredKey;
  inUse: boolean;
  models: ModelByProvider;
  // Null with no other key here: the choice is then left alone, as another device may still hold it.
  movesTo: Provider | null;
  onRemove: () => void;
  onChooseModel: () => void;
}

const addedOn = (stored: StoredKey): string => {
  if (stored.addedAt === null) {
    return `Key ending ${keyEnding(stored)}`;
  }
  const added = new Date(stored.addedAt).toLocaleDateString(undefined, { day: "numeric", month: "long" });
  return `Key ending ${keyEnding(stored)} · added ${added}`;
};

export const ProviderKeyRow = ({ provider, stored, inUse, models, movesTo, onRemove, onChooseModel }: ProviderKeyRowProps) => {
  const [confirming, setConfirming] = useState(false);
  const here = deviceWord(useSurface(), useIsPhone());

  return (
    <li className={`${styles.root} ${inUse ? styles.inUseRow : ""}`} data-testid={providerKeyRowTestIds.root(provider)}>
      <div className={styles.head}>
        <span className={styles.names}>
          <span className={styles.nameLine}>
            <span className={styles.name}>{PROVIDER_LABEL[provider]}</span>
            {inUse && (
              <span className={styles.chip} data-testid={providerKeyRowTestIds.inUse(provider)}>
                In use
              </span>
            )}
          </span>
          {!confirming && (
            <span className={styles.summary} data-testid={providerKeyRowTestIds.summary(provider)}>
              {addedOn(stored)}
            </span>
          )}
        </span>
        {!confirming && (
          <button
            type="button"
            className={styles.remove}
            onClick={() => setConfirming(true)}
            data-testid={providerKeyRowTestIds.remove(provider)}
          >
            Remove
          </button>
        )}
      </div>

      {confirming ? (
        <div className={styles.confirm} data-testid={providerKeyRowTestIds.confirm(provider)}>
          <p className={styles.confirmHeading}>
            Remove your {PROVIDER_SHORT_LABEL[provider]} key from {here}?
          </p>
          <p className={styles.confirmDetail}>
            {inUse && movesTo !== null
              ? `You generate with ${PROVIDER_SHORT_LABEL[provider]}, so new overviews will be made with ${PROVIDER_SHORT_LABEL[movesTo]}, on every device. Overviews ${PROVIDER_SHORT_LABEL[provider]} made stay in your library.`
              : `Overviews it made stay in your library. To use ${PROVIDER_SHORT_LABEL[provider]} here again, you’ll need to paste the key again.`}
          </p>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.confirmRemove}
              onClick={onRemove}
              data-testid={providerKeyRowTestIds.confirmRemove(provider)}
            >
              Remove key
            </button>
            <button
              type="button"
              className={styles.cancel}
              onClick={() => setConfirming(false)}
              data-testid={providerKeyRowTestIds.cancelRemove(provider)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.modelLine}>
          <span className={styles.modelLabel}>Model</span>
          <button
            type="button"
            className={styles.model}
            aria-haspopup="dialog"
            onClick={onChooseModel}
            data-testid={providerKeyRowTestIds.model(provider)}
          >
            {modelLabel(provider, modelFor(models, provider))}
            <StrokeIcon name="chevronRight" size={14} />
          </button>
        </div>
      )}
    </li>
  );
};
