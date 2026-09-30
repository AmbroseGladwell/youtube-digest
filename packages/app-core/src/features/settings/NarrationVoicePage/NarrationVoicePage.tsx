import { Link } from "react-router";
import { useIsPanel } from "../../../app/LayoutContext.js";
import { Routes } from "../../../app/Routes.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { NarrationVoicePicker } from "../components/NarrationVoicePicker/NarrationVoicePicker.js";
import { SettingsPage } from "../SettingsPage/SettingsPage.js";
import settingsStyles from "../SettingsPage/SettingsPage.module.scss";
import styles from "./NarrationVoicePage.module.scss";
import { narrationVoicePageTestIds } from "./NarrationVoicePageTestIds.js";

// Settings › Narration voice: in the panel its own page with a way back (43h); on the full
// layout, Settings itself opened at the section (43i).
export function NarrationVoicePage() {
  const isPanel = useIsPanel();
  if (!isPanel) return <SettingsPage scrollToVoice />;

  return (
    <div className={settingsStyles.root} data-testid={narrationVoicePageTestIds.root}>
      <div className={styles.back}>
        <Link
          className={settingsStyles.backLink}
          to={Routes.settings()}
          data-testid={narrationVoicePageTestIds.backLink}
        >
          <StrokeIcon name="arrowLeft" /> Settings
        </Link>
      </div>
      <NarrationVoicePicker scrollToChosen />
    </div>
  );
}
