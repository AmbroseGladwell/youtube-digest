import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { hasRequiredApiKeys } from "../../../apiKeys/ApiKeys.js";
import { useApiKeys } from "../../../apiKeys/useApiKeys.js";
import { isYouTubeUrl } from "../../util/parseYouTubeUrl.js";
import styles from "./GenerateOverviewForm.module.scss";
import { generateOverviewFormTestIds } from "./GenerateOverviewFormTestIds.js";

export interface GenerateOverviewFormProps {
  url: string;
  onUrlChange: (url: string) => void;
  onSubmit: (url: string) => void;
  onCancel: () => void;
  generationError?: string | null;
}

const canReadClipboard = (): boolean => typeof navigator.clipboard?.readText === "function";

export function GenerateOverviewForm({
  url,
  onUrlChange,
  onSubmit,
  onCancel,
  generationError = null,
}: GenerateOverviewFormProps) {
  const { apiKeys } = useApiKeys();
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!isYouTubeUrl(url)) {
      setValidationError("That doesn't look like a YouTube URL.");
      return;
    }
    setValidationError(null);
    onSubmit(url);
  };

  const keysReady = hasRequiredApiKeys(apiKeys);

  return (
    <form className={styles.root} onSubmit={handleSubmit} data-testid={generateOverviewFormTestIds.root}>
      <label className={styles.field}>
        <span className={styles.label}>Video link</span>
        <input
          type="url"
          className={styles.urlInput}
          placeholder="Paste a YouTube link"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          disabled={!keysReady}
          autoFocus
          data-testid={generateOverviewFormTestIds.urlInput}
        />
      </label>

      {canReadClipboard() && (
        <button
          type="button"
          className={styles.pasteButton}
          onClick={() => void navigator.clipboard.readText().then(onUrlChange)}
          disabled={!keysReady}
          data-testid={generateOverviewFormTestIds.pasteButton}
        >
          Paste from clipboard
        </button>
      )}

      {keysReady ? (
        <p className={styles.note}>
          Fetches the transcript, then writes the overview. Nothing is saved to your library
          unless both succeed.
        </p>
      ) : (
        <p className={styles.note}>
          Generation is bring-your-own-key, and both keys stay on this device.{" "}
          <Link to={Routes.settings()} onClick={onCancel} data-testid={generateOverviewFormTestIds.settingsLink}>
            Add your Anthropic and Supadata keys →
          </Link>
        </p>
      )}

      {validationError && (
        <p className={styles.error} data-testid={generateOverviewFormTestIds.validationError}>
          {validationError}
        </p>
      )}

      {generationError && (
        <p className={styles.error} data-testid={generateOverviewFormTestIds.generationError}>
          {generationError}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          data-testid={generateOverviewFormTestIds.cancelButton}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={styles.generateButton}
          disabled={!keysReady}
          data-testid={generateOverviewFormTestIds.generateButton}
        >
          Generate
        </button>
      </div>
    </form>
  );
}
