import { useEffect, useId, useRef, useState, type Ref } from "react";
import {
  DEFAULT_NARRATION_VOICE,
  NarrationVoice,
  narrationAccent,
  narrationVoiceName,
  type NarrationAccent,
  type VoiceSample,
} from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { formatClock } from "../../../../util/formatClock.js";
import { useNarrationApi } from "../../../player/NarrationApiContext.js";
import { useUpdateSettingsMutation } from "../../mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../queries/settingsQuery.js";
import { ACCENT_GROUP_LABELS } from "../../util/accentGroupLabels.js";
import { useVoiceSamplesQuery } from "../../queries/voiceSamplesQuery.js";
import styles from "./NarrationVoicePicker.module.scss";
import { narrationVoicePickerTestIds } from "./NarrationVoicePickerTestIds.js";
import { useVoiceSamplePlayer, type SamplePlayback } from "./useVoiceSamplePlayer.js";

const ACCENT_NAMES: Record<NarrationAccent, string> = {
  british: "British",
  american: "American",
};

const GROUPS: NarrationAccent[] = ["british", "american"];

const voicesIn = (accent: NarrationAccent) =>
  NarrationVoice.options
    .filter((voice) => narrationAccent(voice) === accent)
    .sort((a, b) => narrationVoiceName(a).localeCompare(narrationVoiceName(b)));

const spokenName = (voice: NarrationVoice) => `${narrationVoiceName(voice)}, ${ACCENT_NAMES[narrationAccent(voice)]}`;

const RING_RADIUS = 16.5;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export interface NarrationVoicePickerProps {
  // The extension's own page and a link from the player bar open it with the reader's voice
  // in view (43f, 43h).
  scrollToChosen?: boolean;
}

// Design OV-43, 43a–43d and 43f: a radio group of voices by accent, each with a sample of
// the same passage. Choosing saves at once; there is no Save button.
export function NarrationVoicePicker({ scrollToChosen = false }: NarrationVoicePickerProps) {
  const api = useNarrationApi();
  const settings = useSettingsQuery().data;
  const updateSettings = useUpdateSettingsMutation();
  const choosing = updateSettings.isPending ? updateSettings.variables.narrationVoice : undefined;
  const chosen = choosing ?? settings?.narrationVoice ?? DEFAULT_NARRATION_VOICE;
  const samples = useVoiceSamplesQuery();
  const samplePlayer = useVoiceSamplePlayer();
  const [justChose, setJustChose] = useState<NarrationVoice | null>(null);
  const headingId = useId();
  const chosenRow = useRef<HTMLDivElement | null>(null);
  const scrolled = useRef(false);
  const settingsLoaded = settings !== undefined;

  useEffect(() => {
    if (!scrollToChosen || !settingsLoaded || scrolled.current) return;
    scrolled.current = true;
    chosenRow.current?.scrollIntoView({ block: "center" });
  }, [scrollToChosen, settingsLoaded]);

  if (api === null) return null;

  const sampleFor = (voice: NarrationVoice): VoiceSample | null =>
    samples.data?.find((sample) => sample.voice === voice) ?? null;

  const choose = (voice: NarrationVoice) => {
    updateSettings.mutate({ narrationVoice: voice });
    setJustChose(voice);
  };

  return (
    <section
      className={styles.root}
      role="radiogroup"
      aria-labelledby={headingId}
      data-testid={narrationVoicePickerTestIds.root}
    >
      <div className={styles.intro}>
        <h2 id={headingId} className={styles.heading}>
          Narration voice
        </h2>
        <p className={styles.standfirst}>
          New audio is read in this voice on every device. Have a listen and see which one you prefer.
        </p>
      </div>

      {samples.isError ? (
        <div className={styles.unavailable} aria-live="polite">
          <p className={styles.unavailableText} data-testid={narrationVoicePickerTestIds.samplesUnavailable}>
            Samples didn't load. You can still choose a voice.
          </p>
          <button
            type="button"
            className={styles.tryAgain}
            onClick={() => void samples.refetch()}
            data-testid={narrationVoicePickerTestIds.tryAgain}
          >
            <StrokeIcon name="rotateCw" size={14} />
            Try again
          </button>
        </div>
      ) : (
        <p className={styles.status} aria-live="polite" data-testid={narrationVoicePickerTestIds.status}>
          {justChose !== null && (
            <>
              <span className={styles.statusIcon}>
                <StrokeIcon name="check" size={15} />
              </span>
              <span>
                <strong className={styles.statusLead}>{narrationVoiceName(justChose)} is your voice now.</strong>{" "}
                <span className={styles.statusRest}>
                  New audio uses it on every device. Notes already narrated keep their voice; you can re-record any
                  of them from the player.
                </span>
              </span>
            </>
          )}
        </p>
      )}

      {GROUPS.map((accent) => (
        <div key={accent} className={styles.group}>
          <p className={styles.groupLabel}>{ACCENT_GROUP_LABELS[accent]}</p>
          <div className={styles.grid}>
            {voicesIn(accent).map((voice) => (
              <VoiceRow
                key={voice}
                voice={voice}
                chosen={voice === chosen}
                rowRef={voice === chosen ? chosenRow : undefined}
                sample={sampleFor(voice)}
                playback={samplePlayer.playback?.voice === voice ? samplePlayer.playback : null}
                onChoose={() => choose(voice)}
                onPlay={(sample) => samplePlayer.play(voice, api.fileUrl(sample), sample.durationSeconds)}
                onStop={samplePlayer.stop}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

interface VoiceRowProps {
  voice: NarrationVoice;
  chosen: boolean;
  rowRef: Ref<HTMLDivElement> | undefined;
  sample: VoiceSample | null;
  playback: SamplePlayback | null;
  onChoose: () => void;
  onPlay: (sample: VoiceSample) => void;
  onStop: () => void;
}

function VoiceRow({ voice, chosen, rowRef, sample, playback, onChoose, onPlay, onStop }: VoiceRowProps) {
  const name = narrationVoiceName(voice);
  const second =
    playback !== null
      ? `Playing · ${formatClock(playback.seconds)} of ${formatClock(playback.durationSeconds)}`
      : chosen
        ? "Your voice"
        : null;
  const progress = playback === null ? 0 : Math.min(1, playback.seconds / playback.durationSeconds);

  return (
    <div
      ref={rowRef}
      className={`${styles.row} ${chosen ? styles.rowChosen : ""}`}
      data-testid={narrationVoicePickerTestIds.row(voice)}
      data-chosen={chosen}
    >
      <label className={styles.choice}>
        <input
          type="radio"
          className={styles.radioInput}
          name="narration-voice"
          value={voice}
          checked={chosen}
          onChange={onChoose}
          aria-label={spokenName(voice)}
          data-testid={narrationVoicePickerTestIds.radio(voice)}
        />
        <span className={styles.radio} aria-hidden="true" />
        <span className={styles.names}>
          <span className={styles.name}>{name}</span>
          {second !== null && (
            <span className={styles.second} data-testid={narrationVoicePickerTestIds.second(voice)}>
              {second}
            </span>
          )}
        </span>
      </label>
      {sample !== null &&
        (playback === null ? (
          <button
            type="button"
            className={styles.play}
            onClick={() => onPlay(sample)}
            aria-label={`Play sample: ${spokenName(voice)}`}
            data-testid={narrationVoicePickerTestIds.play(voice)}
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
                strokeDashoffset={RING_LENGTH * (1 - progress)}
              />
            </svg>
            <button
              type="button"
              className={styles.stop}
              onClick={onStop}
              aria-label={`Stop sample: ${spokenName(voice)}`}
              data-testid={narrationVoicePickerTestIds.stop(voice)}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          </span>
        ))}
    </div>
  );
}
