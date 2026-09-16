import { useState, type FormEvent } from "react";
import type { Overview } from "@overview/types";
import { hasRequiredApiKeys } from "../../../apiKeys/ApiKeys.js";
import { useApiKeys } from "../../../apiKeys/useApiKeys.js";
import { ApiKeysPanel } from "../ApiKeysPanel/ApiKeysPanel.js";
import { useGenerateOverviewMutation } from "../../mutations/useGenerateOverviewMutation.js";
import { isYouTubeUrl } from "../../util/parseYouTubeUrl.js";
import styles from "./GenerateOverviewForm.module.scss";
import { generateOverviewFormTestIds } from "./GenerateOverviewFormTestIds.js";

export interface GenerateOverviewFormProps {
  variant?: "hero" | "compact";
  onGenerated?: (overview: Overview) => void;
}

const PHASE_LABEL: Record<string, string> = {
  "fetching-transcript": "Fetching the transcript…",
  generating: "Writing the overview…",
  saving: "Saving…",
};

export function GenerateOverviewForm({ variant = "hero", onGenerated }: GenerateOverviewFormProps) {
  const { apiKeys, setApiKeys } = useApiKeys();
  const [showKeysPanel, setShowKeysPanel] = useState(!hasRequiredApiKeys(apiKeys));
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const generateOverview = useGenerateOverviewMutation(apiKeys);

  const handleSaveKeys = (patch: Parameters<typeof setApiKeys>[0]) => {
    setApiKeys(patch);
    setShowKeysPanel(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!isYouTubeUrl(url)) {
      setValidationError("That doesn't look like a YouTube URL.");
      return;
    }
    setValidationError(null);
    generateOverview.mutate(
      { url },
      {
        onSuccess: (overview) => {
          setUrl("");
          onGenerated?.(overview);
        },
      },
    );
  };

  const keysReady = hasRequiredApiKeys(apiKeys);

  return (
    <div
      className={`${styles.root} ${variant === "compact" ? styles.compact : ""}`}
      data-testid={generateOverviewFormTestIds.root}
    >
      {showKeysPanel || !keysReady ? (
        <div className={styles.keysPanelSlot}>
          <ApiKeysPanel apiKeys={apiKeys} onSave={handleSaveKeys} />
        </div>
      ) : (
        <div className={styles.keysRow}>
          <span className={styles.keysStatus}>Using your saved API keys</span>
          <button
            type="button"
            className={styles.editKeysButton}
            onClick={() => setShowKeysPanel(true)}
            data-testid={generateOverviewFormTestIds.editKeysButton}
          >
            Change keys
          </button>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          type="url"
          className={styles.urlInput}
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={!keysReady || generateOverview.isPending}
          data-testid={generateOverviewFormTestIds.urlInput}
        />
        <button
          type="submit"
          className={styles.generateButton}
          disabled={!keysReady || generateOverview.isPending}
          data-testid={generateOverviewFormTestIds.generateButton}
        >
          {generateOverview.isPending ? "Generating…" : "Generate overview"}
        </button>
      </form>

      {validationError && (
        <p className={styles.validationError} data-testid={generateOverviewFormTestIds.validationError}>
          {validationError}
        </p>
      )}

      {generateOverview.isPending && generateOverview.phase && (
        <p className={styles.progress} data-testid={generateOverviewFormTestIds.progress}>
          {PHASE_LABEL[generateOverview.phase]}
        </p>
      )}

      {generateOverview.isError && (
        <p className={styles.generationError} data-testid={generateOverviewFormTestIds.generationError}>
          {generateOverview.error.message}
        </p>
      )}
    </div>
  );
}
