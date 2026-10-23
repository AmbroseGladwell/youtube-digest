import { useState } from "react";
import { DEFAULT_PROVIDER, PROVIDERS, type Provider } from "@overview/domain";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { hasKeyFor, providersWithKeys } from "../../../apiKeys/ApiKeys.js";
import { BYO_KEY_NOTE_SHORT } from "../../../apiKeys/byoKeyNote.js";
import { deviceWord } from "../../../apiKeys/keyPrompt.js";
import { forgetAllCatalogues, forgetCatalogue } from "../../../apiKeys/ModelCatalogue.js";
import { useProviderPermissions } from "../../../apiKeys/ProviderPermissionContext.js";
import { useApiKeys } from "../../../apiKeys/useApiKeys.js";
import { useGenerationReadiness } from "../../../newOverview/useGenerationReadiness.js";
import { useUpdateSettingsMutation } from "../../mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../queries/settingsQuery.js";
import { AddProviderKeyRow } from "../AddProviderKeyRow/AddProviderKeyRow.js";
import { GenerateWithCard } from "../GenerateWithCard/GenerateWithCard.js";
import { ModelPickerDialog } from "../ModelPickerDialog/ModelPickerDialog.js";
import { OnlyMyKeySwitch } from "../OnlyMyKeySwitch/OnlyMyKeySwitch.js";
import { ProviderKeyRow } from "../ProviderKeyRow/ProviderKeyRow.js";
import styles from "./ApiKeysPanel.module.scss";
import { apiKeysPanelTestIds } from "./ApiKeysPanelTestIds.js";

export const NO_KEYS_STANDFIRST =
  "To write overviews you’ll need your own API key from one of these providers.";

// A list, because holding several keys is the point (design 110a, Q1). Keys on this device
// come first as full rows; providers without one sit below as quiet one-line rows. On a
// first run there is no list to join yet, so all six are shown the same way and the
// "Generate with" card is absent — there is nothing to generate with.
export function ApiKeysPanel() {
  const { apiKeys, removeKey, removeAllKeys } = useApiKeys();
  const settingsQuery = useSettingsQuery();
  const updateSettings = useUpdateSettingsMutation();
  const permissions = useProviderPermissions();
  const analytics = useAnalytics();
  const here = deviceWord(useSurface(), useIsPhone());
  const { ourKeyUsable } = useGenerationReadiness();

  const [adding, setAdding] = useState<Provider | null>(null);
  const [removingAll, setRemovingAll] = useState(false);
  const [pickingModelFor, setPickingModelFor] = useState<Provider | null>(null);

  const provider = settingsQuery.data?.provider ?? DEFAULT_PROVIDER;
  const models = settingsQuery.data?.modelByProvider ?? {};
  const held = providersWithKeys(apiKeys);
  const others = PROVIDERS.filter((candidate) => !hasKeyFor(apiKeys, candidate));

  const choose = (next: Provider, from: "picker" | "no-key-here") => {
    analytics.settings.apiKeys.providerChosen({ provider: next, from });
    updateSettings.mutate({ provider: next });
  };

  const remove = (gone: Provider) => {
    const movesTo = held.find((candidate) => candidate !== gone) ?? null;
    analytics.settings.apiKeys.keyRemoved({ provider: gone, wasChoice: gone === provider });
    removeKey(gone);
    forgetCatalogue(gone);
    void permissions?.drop(gone);
    // The choice moves only when this device can honour the move. With no other key here
    // it is left alone: another device may still hold it (design 110i).
    if (gone === provider && movesTo !== null) {
      updateSettings.mutate({ provider: movesTo });
    }
  };

  const removeEverything = () => {
    analytics.settings.apiKeys.allKeysRemoved({ removed: held.length });
    for (const gone of held) {
      void permissions?.drop(gone);
    }
    removeAllKeys();
    forgetAllCatalogues();
    setRemovingAll(false);
  };

  const addRow = (candidate: Provider) => (
    <AddProviderKeyRow
      key={candidate}
      provider={candidate}
      open={adding === candidate}
      onOpen={() => setAdding(candidate)}
      onClose={() => setAdding(null)}
      onSaved={() => setAdding(null)}
      inUseProvider={held.length === 0 ? null : provider}
    />
  );

  return (
    <div className={styles.root} data-testid={apiKeysPanelTestIds.root}>
      {held.length === 0 ? (
        <>
          <p className={styles.standfirst} data-testid={apiKeysPanelTestIds.standfirst}>
            {NO_KEYS_STANDFIRST}
          </p>
          <p className={styles.groupLabel} data-testid={apiKeysPanelTestIds.chooseLabel}>
            Choose a provider
          </p>
          <ul className={styles.list}>{PROVIDERS.map(addRow)}</ul>
        </>
      ) : (
        <>
          <GenerateWithCard
            provider={provider}
            models={models}
            held={held}
            onChoose={(next) => choose(next, hasKeyFor(apiKeys, provider) ? "picker" : "no-key-here")}
            onAddKeyFor={setAdding}
          />

          <p className={styles.groupLabel} data-testid={apiKeysPanelTestIds.keysHeading}>
            Keys on {here}
          </p>
          <ul className={styles.list}>
            {held.map((candidate) => {
              const stored = apiKeys.keys[candidate];
              return stored === undefined ? null : (
                <ProviderKeyRow
                  key={candidate}
                  provider={candidate}
                  stored={stored}
                  inUse={candidate === provider}
                  models={models}
                  movesTo={held.find((other) => other !== candidate) ?? null}
                  onRemove={() => remove(candidate)}
                  onChooseModel={() => setPickingModelFor(candidate)}
                />
              );
            })}
          </ul>

          {ourKeyUsable && <OnlyMyKeySwitch />}

          {others.length > 0 && (
            <>
              <p className={styles.groupLabel} data-testid={apiKeysPanelTestIds.othersHeading}>
                Other providers
              </p>
              <ul className={styles.list}>{others.map(addRow)}</ul>
            </>
          )}

          {removingAll ? (
            <div className={styles.removeAllConfirm} data-testid={apiKeysPanelTestIds.removeAllConfirm}>
              <p className={styles.confirmHeading}>
                Remove {held.length === 1 ? "your key" : `all ${held.length} keys`} from {here}?
              </p>
              <p className={styles.confirmDetail}>
                Overviews they made stay in your library. Nothing can be made here until you add a key again. Your
                other devices keep their own keys.
              </p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.removeAllYes}
                  onClick={removeEverything}
                  data-testid={apiKeysPanelTestIds.removeAllYes}
                >
                  {held.length === 1 ? "Remove key" : "Remove all keys"}
                </button>
                <button
                  type="button"
                  className={styles.cancel}
                  onClick={() => setRemovingAll(false)}
                  data-testid={apiKeysPanelTestIds.removeAllCancel}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={styles.removeAll}
              onClick={() => setRemovingAll(true)}
              data-testid={apiKeysPanelTestIds.removeAll}
            >
              Remove all keys from {here}
            </button>
          )}
        </>
      )}

      {/* The note ends the section rather than opening it, so the list and the choice land
          above the fold in the 600-tall panel (design 110a's notes). */}
      <p className={styles.note} data-testid={apiKeysPanelTestIds.note}>
        {BYO_KEY_NOTE_SHORT}
      </p>

      <ModelPickerDialog
        provider={pickingModelFor}
        apiKey={pickingModelFor === null ? null : (apiKeys.keys[pickingModelFor]?.key ?? null)}
        onClose={() => setPickingModelFor(null)}
      />
    </div>
  );
}
