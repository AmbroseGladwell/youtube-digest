import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./RecipeReadAloud.module.scss";

// One list's part of the narration: the line it is on, whether the voice is in this list, and
// the press that plays just this list or pauses it (design 144t, OV-148).
export interface RecipeListVoice {
  activeIndex: number | null;
  reading: boolean;
  speaking: boolean;
  onPress: () => void;
}

export interface RecipeReadAloudProps {
  voice: RecipeListVoice;
  label: "them" | "it";
  testId: string;
}

export function RecipeReadAloud({ voice, label, testId }: RecipeReadAloudProps) {
  return (
    <button type="button" className={styles.button} onClick={voice.onPress} aria-pressed={voice.reading} data-testid={testId}>
      <StrokeIcon name={voice.reading ? "pause" : "volume"} size={13} />
      {voice.reading ? "Pause reading" : `Read ${label} aloud`}
    </button>
  );
}
