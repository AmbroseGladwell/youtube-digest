import { useState } from "react";
import styles from "./TranscriptPanel.module.scss";
import { transcriptPanelTestIds } from "./TranscriptPanelTestIds.js";
import { PLACEHOLDER_TRANSCRIPT } from "./placeholderTranscript.js";

export function TranscriptPanel() {
  const [activeRow, setActiveRow] = useState(0);

  return (
    <div className={styles.root} data-testid={transcriptPanelTestIds.root}>
      <p className={styles.head}>
        <span>Full transcript</span>
        <span className={styles.placeholderNote} data-testid={transcriptPanelTestIds.placeholderNote}>
          Placeholder — no transcript is stored yet
        </span>
      </p>
      {PLACEHOLDER_TRANSCRIPT.map((row, index) => (
        <button
          key={row.time}
          type="button"
          className={`${styles.row} ${index === activeRow ? styles.rowActive : ""}`}
          aria-current={index === activeRow}
          onClick={() => setActiveRow(index)}
          data-testid={transcriptPanelTestIds.row}
        >
          <span className={styles.time}>{row.time}</span>
          <span className={styles.text}>{row.text}</span>
        </button>
      ))}
    </div>
  );
}
