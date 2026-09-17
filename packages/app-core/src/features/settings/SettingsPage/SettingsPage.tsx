import { useState } from "react";
import { Link } from "react-router";
import { Routes } from "../../../app/Routes.js";
import { useApiKeys } from "../../apiKeys/useApiKeys.js";
import { ApiKeysPanel } from "../components/ApiKeysPanel/ApiKeysPanel.js";
import styles from "./SettingsPage.module.scss";
import { settingsPageTestIds } from "./SettingsPageTestIds.js";

export function SettingsPage() {
  const { apiKeys, setApiKeys } = useApiKeys();
  const [saved, setSaved] = useState(false);

  return (
    <div className={styles.root} data-testid={settingsPageTestIds.root}>
      <Link className={styles.backLink} to={Routes.home()} data-testid={settingsPageTestIds.backLink}>
        ← All overviews
      </Link>
      <h2 className={styles.title}>Settings</h2>
      <p className={styles.standfirst}>
        Bring-your-own-key. Both keys stay on this device and go straight to Anthropic and
        Supadata — never through our servers.
      </p>

      <ApiKeysPanel
        apiKeys={apiKeys}
        onSave={(patch) => {
          setApiKeys(patch);
          setSaved(true);
        }}
      />

      {saved && (
        <p className={styles.saved} data-testid={settingsPageTestIds.savedConfirmation}>
          Saved on this device.
        </p>
      )}
    </div>
  );
}
