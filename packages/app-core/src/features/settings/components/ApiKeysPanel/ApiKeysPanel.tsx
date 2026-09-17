import { useEffect, useRef, useState, type FormEvent } from "react";
import { ANTHROPIC_MODEL_OPTIONS, DEFAULT_ANTHROPIC_MODEL, type AnthropicModel } from "@overview/types";
import type { ApiKeys } from "../../../apiKeys/ApiKeys.js";
import { useUpdateSettingsMutation } from "../../mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../queries/settingsQuery.js";
import styles from "./ApiKeysPanel.module.scss";
import { apiKeysPanelTestIds } from "./ApiKeysPanelTestIds.js";

export interface ApiKeysPanelProps {
  apiKeys: ApiKeys;
  onSave: (patch: Partial<ApiKeys>) => void;
}

const toStoredValue = (raw: string): string | null => (raw.trim() === "" ? null : raw.trim());

export function ApiKeysPanel({ apiKeys, onSave }: ApiKeysPanelProps) {
  const [anthropicApiKey, setAnthropicApiKey] = useState(apiKeys.anthropicApiKey ?? "");
  const [supadataApiKey, setSupadataApiKey] = useState(apiKeys.supadataApiKey ?? "");
  const settingsQuery = useSettingsQuery();
  const updateSettings = useUpdateSettingsMutation();
  const savedModel = settingsQuery.data?.model ?? DEFAULT_ANTHROPIC_MODEL;
  // Local draft, committed only on submit — same explicit-save pattern as the keys
  // below. A model choice changes real per-generation cost, so it shouldn't persist
  // from a bare <select> onChange (form-restoration/autofill can fire one on a
  // freshly-mounted select with no real user selection behind it).
  const [modelDraft, setModelDraft] = useState(savedModel);
  const selectedOption = ANTHROPIC_MODEL_OPTIONS.find((option) => option.id === modelDraft);

  // settingsQuery resolves asynchronously (an IndexedDB read), so the real saved model
  // may arrive after this component's first render. Sync the draft once, the first time
  // real data lands — never again after, so it can't clobber an in-progress edit if the
  // query refetches later.
  const hasSyncedDraft = useRef(false);
  useEffect(() => {
    if (settingsQuery.data && !hasSyncedDraft.current) {
      hasSyncedDraft.current = true;
      setModelDraft(settingsQuery.data.model);
    }
  }, [settingsQuery.data]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSave({
      anthropicApiKey: toStoredValue(anthropicApiKey),
      supadataApiKey: toStoredValue(supadataApiKey),
    });
    if (modelDraft !== savedModel) {
      updateSettings.mutate({ model: modelDraft });
    }
  };

  return (
    <form className={styles.root} onSubmit={handleSubmit} data-testid={apiKeysPanelTestIds.root}>
      <p className={styles.heading}>Connect your keys</p>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="anthropic-api-key">
          Anthropic API key
        </label>
        <input
          id="anthropic-api-key"
          className={styles.input}
          type="password"
          autoComplete="off"
          value={anthropicApiKey}
          onChange={(event) => setAnthropicApiKey(event.target.value)}
          data-testid={apiKeysPanelTestIds.anthropicInput}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="supadata-api-key">
          Supadata API key
        </label>
        <input
          id="supadata-api-key"
          className={styles.input}
          type="password"
          autoComplete="off"
          value={supadataApiKey}
          onChange={(event) => setSupadataApiKey(event.target.value)}
          data-testid={apiKeysPanelTestIds.supadataInput}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="generation-model">
          Model
        </label>
        <select
          id="generation-model"
          className={styles.input}
          autoComplete="off"
          value={modelDraft}
          onChange={(event) => setModelDraft(event.target.value as AnthropicModel)}
          data-testid={apiKeysPanelTestIds.modelSelect}
        >
          {ANTHROPIC_MODEL_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {selectedOption && <p className={styles.modelDescription}>{selectedOption.description}</p>}
      </div>

      <button type="submit" className={styles.saveButton} data-testid={apiKeysPanelTestIds.saveButton}>
        Save keys
      </button>
    </form>
  );
}
