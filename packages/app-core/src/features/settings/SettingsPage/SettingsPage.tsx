import { useState } from "react";
import { Link } from "react-router";
import { Routes } from "../../../app/Routes.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPanel } from "../../../app/LayoutContext.js";
import { useSurface } from "../../../app/SurfaceContext.js";
import { BYO_KEY_NOTE } from "../../apiKeys/byoKeyNote.js";
import { useApiKeys } from "../../apiKeys/useApiKeys.js";
import { PlusPlanPanel } from "../../plus/components/PlusPlanPanel/PlusPlanPanel.js";
import { SyncPanel } from "../../sync/components/SyncPanel/SyncPanel.js";
import { ApiKeysPanel } from "../components/ApiKeysPanel/ApiKeysPanel.js";
import { BuildLine } from "../components/BuildLine/BuildLine.js";
import { NarrationVoicePicker } from "../components/NarrationVoicePicker/NarrationVoicePicker.js";
import { NarrationVoiceRow } from "../components/NarrationVoiceRow/NarrationVoiceRow.js";
import styles from "./SettingsPage.module.scss";
import { settingsPageTestIds } from "./SettingsPageTestIds.js";

export interface SettingsPageProps {
  scrollToVoice?: boolean;
}

export function SettingsPage({ scrollToVoice = false }: SettingsPageProps) {
  const { apiKeys, setApiKeys } = useApiKeys();
  const surface = useSurface();
  const isPanel = useIsPanel();
  const [saved, setSaved] = useState(false);

  return (
    <div className={styles.root} data-testid={settingsPageTestIds.root}>
      <Link
        className={styles.backLink}
        to={Routes.home()}
        data-testid={settingsPageTestIds.backLink}
      >
        <StrokeIcon name="arrowLeft" /> {isPanel ? "Back" : "All overviews"}
      </Link>
      <h2 className={styles.title}>Settings</h2>

      {isPanel ? <NarrationVoiceRow /> : <NarrationVoicePicker scrollToChosen={scrollToVoice} />}

      <PlusPlanPanel />

      <p className={styles.standfirst}>{BYO_KEY_NOTE}</p>

      {surface === "extension" && (
        <p className={styles.standfirst} data-testid={settingsPageTestIds.separateLibraryNote}>
          This is the extension's own library. The browser keeps it separate from the one on the web
          app, so an overview made here won't appear there. Syncing the two is what an account will
          be for.
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

      <SyncPanel />

      <BuildLine />
    </div>
  );
}
