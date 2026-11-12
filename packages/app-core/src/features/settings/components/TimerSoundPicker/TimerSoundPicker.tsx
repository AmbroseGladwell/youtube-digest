import { useId } from "react";
import { DEFAULT_TIMER_SOUND, TimerSound } from "@overview/domain";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useUpdateSettingsMutation } from "../../mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../queries/settingsQuery.js";
import { TIMER_SOUND_LABELS } from "../../util/timerSoundLabels.js";
import styles from "./TimerSoundPicker.module.scss";
import { timerSoundPickerTestIds } from "./TimerSoundPickerTestIds.js";
import { useTimerSoundSample } from "./useTimerSoundSample.js";

export const COOKING_STANDFIRST = "For Cook step by step on a recipe.";

const RING_RADIUS = 16.5;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

// Designs 284ai–284al: the narration voice picker's rows for the four timer sounds, each with a
// sample. Choosing saves at once and syncs; there is no Save button.
export function TimerSoundPicker() {
  const analytics = useAnalytics();
  const settings = useSettingsQuery().data;
  const updateSettings = useUpdateSettingsMutation();
  const choosing = updateSettings.isPending ? updateSettings.variables.timerSound : undefined;
  const chosen = choosing ?? settings?.timerSound ?? DEFAULT_TIMER_SOUND;
  const sample = useTimerSoundSample();
  const headingId = useId();

  const choose = (sound: TimerSound) => {
    analytics.settings.cooking.timerSoundChosen({ sound });
    updateSettings.mutate({ timerSound: sound });
  };

  return (
    <div className={styles.root} data-testid={timerSoundPickerTestIds.root}>
      <h3 id={headingId} className={styles.heading}>
        Timer sound
      </h3>
      <div className={styles.list} role="radiogroup" aria-labelledby={headingId}>
        {TimerSound.options.map((sound) => {
          const { name, line } = TIMER_SOUND_LABELS[sound];
          const isChosen = sound === chosen;
          const playback = sample.playback?.sound === sound ? sample.playback : null;
          return (
            <div
              key={sound}
              className={`${styles.row} ${isChosen ? styles.rowChosen : ""}`}
              data-chosen={isChosen}
              data-testid={timerSoundPickerTestIds.row(sound)}
            >
              <label className={styles.choice}>
                <input
                  type="radio"
                  className={styles.radioInput}
                  name="timer-sound"
                  value={sound}
                  checked={isChosen}
                  onChange={() => choose(sound)}
                  aria-label={name}
                  data-testid={timerSoundPickerTestIds.radio(sound)}
                />
                <span className={styles.radio} aria-hidden="true" />
                <span className={styles.names}>
                  <span className={styles.name}>
                    {name}
                    {isChosen && (
                      <span className={styles.tag} data-testid={timerSoundPickerTestIds.chosenTag}>
                        Your sound
                      </span>
                    )}
                  </span>
                  <span className={styles.line}>{line}</span>
                </span>
              </label>
              {playback === null ? (
                <button
                  type="button"
                  className={styles.play}
                  onClick={() => {
                    analytics.settings.cooking.timerSoundPlayed({ sound });
                    sample.play(sound);
                  }}
                  aria-label={`Play ${name}`}
                  data-testid={timerSoundPickerTestIds.play(sound)}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
                    <path d="M6 4.6v14.8a1 1 0 0 0 1.5.86l12.3-7.4a1 1 0 0 0 0-1.72L7.5 3.74A1 1 0 0 0 6 4.6Z" />
                  </svg>
                </button>
              ) : (
                <span className={styles.playing}>
                  <svg className={styles.ring} viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
                    <circle className={styles.ringTrack} cx="18" cy="18" r={RING_RADIUS} />
                    <circle
                      className={styles.ringFill}
                      cx="18"
                      cy="18"
                      r={RING_RADIUS}
                      strokeDasharray={RING_LENGTH}
                      strokeDashoffset={RING_LENGTH * (1 - playback.progress)}
                    />
                  </svg>
                  <button
                    type="button"
                    className={styles.stop}
                    onClick={() => {
                      analytics.settings.cooking.timerSoundStopped({ sound });
                      sample.stop();
                    }}
                    aria-label={`Stop ${name}`}
                    data-testid={timerSoundPickerTestIds.stop(sound)}
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className={styles.note}>
        Saved as soon as you choose, on every device you sign in on. It plays at your device’s volume, and vibrates too where it can.
      </p>
    </div>
  );
}
