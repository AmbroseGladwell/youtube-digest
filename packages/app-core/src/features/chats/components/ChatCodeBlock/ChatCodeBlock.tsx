import { useEffect, useState } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { copyText } from "../../../reader/util/handOffFollowUp.js";
import styles from "./ChatCodeBlock.module.scss";
import { chatCodeBlockTestIds } from "./ChatCodeBlockTestIds.js";

const COPIED_MS = 2000;

export interface ChatCodeBlockProps {
  language: string;
  code: string;
}

export const ChatCodeBlock = ({ language, code }: ChatCodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) {
      return;
    }
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
};
