import { useState } from "react";
import { Link } from "react-router";
import {
  modelFor,
  modelLabel,
  PROVIDER_LABEL,
  PROVIDER_SHORT_LABEL,
  type ModelByProvider,
  type Provider,
} from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { keyEnding, type StoredKey } from "../../../apiKeys/ApiKeys.js";
import { deviceWord } from "../../../apiKeys/keyPrompt.js";
import styles from "./ProviderKeyRow.module.scss";
import { providerKeyRowTestIds } from "./ProviderKeyRowTestIds.js";

export interface ProviderKeyRowProps {
  provider: Provider;
  stored: StoredKey;
  inUse: boolean;
  models: ModelByProvider;
  // Where generation goes if this key is the one in use and it is removed. Null when this
  // device holds no other key, in which case the choice is left alone: another device may
  // still hold it (design 110i).
  movesTo: Provider | null;
  onRemove: () => void;
}

const addedOn = (stored: StoredKey): string => {
  if (stored.addedAt === null) {
    return `Key ending ${keyEnding(stored)}`;
  }
  const added = new Date(stored.addedAt).toLocaleDateString(undefined, { day: "numeric", month: "long" });
  return `Key ending ${keyEnding(stored)} · added ${added}`;
};

// One provider the reader has a key for: what it is, that it is the one in use, what the
// key ends in, and the model it remembers (design 110c).
export function ProviderKeyRow({ provider, stored, inUse, models, movesTo, onRemove }: ProviderKeyRowProps) {
  const [confirming, setConfirming] = useState(false);
  const here = deviceWord(useSurface(), useIsPhone());

  return (
    <li className={`${styles.root} ${inUse ? styles.inUseRow : ""}`} data-testid={providerKeyRowTestIds.root(provider)}>
      <div className={styles.head}>
        <span className={styles.name}>{PROVIDER_LABEL[provider]}</span>
        {inUse && (
          <span className={styles.chip} data-testid={providerKeyRowTestIds.inUse(provider)}>
            In use
          </span>
        )}
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
        <>
          <p className={styles.summary} data-testid={providerKeyRowTestIds.summary(provider)}>
            {addedOn(stored)}
          </p>
          <Link
            className={styles.model}
            to={Routes.settingsModel(provider)}
            data-testid={providerKeyRowTestIds.model(provider)}
          >
            <span className={styles.modelLabel}>Model</span>
            <span className={styles.modelValue}>{modelLabel(provider, modelFor(models, provider))}</span>
          </Link>
        </>
      )}
    </li>
  );
}
