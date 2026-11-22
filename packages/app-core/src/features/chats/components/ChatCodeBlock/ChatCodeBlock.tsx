import { useEffect, useState } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { copyText } from "../../../reader/util/handOffFollowUp.js";
import styles from "./ChatCodeBlock.module.scss";
import { chatCodeBlockTestIds } from "./ChatCodeBlockTestIds.js";

const COPIED_MS = 2000;

// OV-364: a fenced block of code in an answer, monospace on the surface tint, its language named
// when the answer gave one, with Copy. It scrolls sideways rather than wrapping, and can be reached
// by keyboard to do so.
export function ChatCodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className={styles.root} data-testid={chatCodeBlockTestIds.root}>
      <div className={styles.head}>
        <span className={styles.language}>{language === "" ? "Code" : language}</span>
        <button
          type="button"
          className={styles.copy}
          aria-label={copied ? "Code copied" : "Copy code"}
          onClick={() => void copyText(code).then(setCopied)}
          data-testid={chatCodeBlockTestIds.copy}
        >
          <StrokeIcon name={copied ? "check" : "copy"} size={13} />
          <span aria-hidden="true">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className={styles.pre} tabIndex={0} aria-label={language === "" ? "Code" : `${language} code`}>
        <code data-testid={chatCodeBlockTestIds.code}>{code}</code>
      </pre>
    </div>
  );
}
