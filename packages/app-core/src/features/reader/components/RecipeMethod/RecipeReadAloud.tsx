import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./RecipeReadAloud.module.scss";

// One list's own voice: the line it is on, whether it is reading, and the press that starts
// or pauses it (design 144t).
export interface RecipeListVoice {
  activeIndex: number | null;
  reading: boolean;
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
