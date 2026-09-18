import { useState } from "react";
import { Link } from "react-router";
import { Routes } from "../../../app/Routes.js";
import { useSurface } from "../../../app/SurfaceContext.js";
import { useApiKeys } from "../../apiKeys/useApiKeys.js";
import { ApiKeysPanel } from "../components/ApiKeysPanel/ApiKeysPanel.js";
import styles from "./SettingsPage.module.scss";
import { settingsPageTestIds } from "./SettingsPageTestIds.js";

export function SettingsPage() {
  const { apiKeys, setApiKeys } = useApiKeys();
  const surface = useSurface();
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

      {surface === "extension" && (
        <p className={styles.standfirst} data-testid={settingsPageTestIds.separateLibraryNote}>
          This is the extension's own library. The browser keeps it separate from the one on
          the web app, so an overview made here won't appear there. Syncing the two is what an
          account will be for.
        </p>
      )}

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
