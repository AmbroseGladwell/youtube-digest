import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./RecipeReadAloud.module.scss";

export interface RecipeListVoice {
  activeIndex: number | null;
  reading: boolean;
  speaking: boolean;
  onPress: () => void;
  onSelect: (index: number) => void;
}

export interface RecipeReadAloudProps {
  voice: RecipeListVoice;
  label: "them" | "it";
  testId: string;
}

export const RecipeReadAloud = ({ voice, label, testId }: RecipeReadAloudProps) => {
  return (
    <button type="button" className={styles.button} onClick={voice.onPress} aria-pressed={voice.reading} data-testid={testId}>
      <StrokeIcon name={voice.reading ? "pause" : "volume"} size={13} />
      {voice.reading ? "Pause reading" : `Read ${label} aloud`}
    </button>
  );
};
