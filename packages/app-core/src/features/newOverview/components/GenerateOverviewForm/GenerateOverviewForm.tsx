import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router";
import type { Overview } from "@overview/types";
import { Routes } from "../../../../app/Routes.js";
import { hasRequiredApiKeys } from "../../../apiKeys/ApiKeys.js";
import { useApiKeys } from "../../../apiKeys/useApiKeys.js";
import { useGenerateOverviewMutation } from "../../mutations/useGenerateOverviewMutation.js";
import { isYouTubeUrl } from "../../util/parseYouTubeUrl.js";
import styles from "./GenerateOverviewForm.module.scss";
import { generateOverviewFormTestIds } from "./GenerateOverviewFormTestIds.js";

export interface GenerateOverviewFormProps {
  onGenerated?: (overview: Overview) => void;
}

const PHASE_LABEL: Record<string, string> = {
  "fetching-transcript": "Fetching the transcript…",
  generating: "Writing the overview…",
  saving: "Saving…",
};

export function GenerateOverviewForm({ onGenerated }: GenerateOverviewFormProps) {
  const { apiKeys } = useApiKeys();
  const { pathname } = useLocation();
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const generateOverview = useGenerateOverviewMutation(apiKeys);

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
    <div className={styles.root} data-testid={generateOverviewFormTestIds.root}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          type="url"
          className={styles.urlInput}
          placeholder="Paste a YouTube link"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={!keysReady || generateOverview.isPending}
          aria-label="YouTube URL"
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

      {!keysReady && pathname !== Routes.settings() && (
        <Link
          className={styles.settingsLink}
          to={Routes.settings()}
          data-testid={generateOverviewFormTestIds.settingsLink}
        >
          Add your Anthropic and Supadata keys →
        </Link>
      )}

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
