import styles from "./PlayPauseIcon.module.scss";

export interface PlayPauseIconProps {
  playing: boolean;
}

// Drawn rather than typed, for the reason FavouriteIcon is: ▶ and ❚❚ are unrelated glyphs
// whose serif faces are different widths, so the control's contents jumped every time it
// was pressed. Two paths in one box cross-fade instead.
export function PlayPauseIcon({ playing }: PlayPauseIconProps) {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path
        className={`${styles.glyph} ${playing ? "" : styles.glyphShown}`}
        d="M7 4.5l12 7.5-12 7.5z"
      />
      <path
        className={`${styles.glyph} ${playing ? styles.glyphShown : ""}`}
        d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z"
      />
    </svg>
  );
}
