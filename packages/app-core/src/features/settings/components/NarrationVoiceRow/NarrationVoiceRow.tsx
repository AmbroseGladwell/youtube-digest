import { Link } from "react-router";
import { DEFAULT_NARRATION_VOICE, narrationAccent, narrationVoiceName } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useNarrationApi } from "../../../player/NarrationApiContext.js";
import { useSettingsQuery } from "../../queries/settingsQuery.js";
import { ACCENT_GROUP_LABELS } from "../../util/accentGroupLabels.js";
import styles from "./NarrationVoiceRow.module.scss";
import { narrationVoiceRowTestIds } from "./NarrationVoiceRowTestIds.js";

// Design 43g: the panel keeps Settings short, so the voice is one row that opens the list.
export function NarrationVoiceRow() {
  const api = useNarrationApi();
  const voice = useSettingsQuery().data?.narrationVoice ?? DEFAULT_NARRATION_VOICE;
  if (api === null) return null;

  return (
    <section className={styles.root}>
      <h2 className={styles.heading}>Narration voice</h2>
      <Link className={styles.row} to={Routes.narrationVoice()} data-testid={narrationVoiceRowTestIds.root}>
        <span className={styles.names}>
          <span className={styles.name}>{narrationVoiceName(voice)}</span>
          <span className={styles.second}>{ACCENT_GROUP_LABELS[narrationAccent(voice)]} · hear the others</span>
        </span>
        <span className={styles.chevron}>
          <StrokeIcon name="chevronRight" size={18} />
        </span>
      </Link>
    </section>
  );
}
