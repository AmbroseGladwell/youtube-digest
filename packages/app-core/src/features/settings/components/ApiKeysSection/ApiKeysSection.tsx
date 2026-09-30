import { useState } from "react";
import { useApiKeys } from "../../../apiKeys/useApiKeys.js";
import { ApiKeysPanel } from "../ApiKeysPanel/ApiKeysPanel.js";
import styles from "./ApiKeysSection.module.scss";
import { apiKeysSectionTestIds } from "./ApiKeysSectionTestIds.js";

export function ApiKeysSection() {
  const { apiKeys, setApiKeys } = useApiKeys();
  const [saved, setSaved] = useState(false);

  return (
    <>
      <ApiKeysPanel
        apiKeys={apiKeys}
        onSave={(patch) => {
          setApiKeys(patch);
          setSaved(true);
        }}
      />
      {saved && (
        <p className={styles.saved} data-testid={apiKeysSectionTestIds.savedConfirmation}>
          Saved on this device.
        </p>
      )}
    </>
  );
}
