import { useLayoutEffect, useRef, useState } from "react";
import styles from "./CutText.module.scss";
import { cutTextTestIds } from "./CutTextTestIds.js";

export interface CutTextProps {
  text: string;
  // The caller's own line styles, which cut the text with an ellipsis or a line clamp.
  className: string | undefined;
  testId?: string;
}

// Text cut to its lines shows the whole of it in a tip on hover, or when the control holding it
// has keyboard focus. The text is already in the page, so the tip is hidden from screen readers.
export function CutText({ text, className, testId }: CutTextProps) {
  const element = useRef<HTMLSpanElement | null>(null);
  const [cut, setCut] = useState(false);

  useLayoutEffect(() => {
    const shown = element.current;
    if (shown === null) return;
    const measure = () => setCut(shown.scrollWidth > shown.clientWidth + 1 || shown.scrollHeight > shown.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(shown);
    return () => observer.disconnect();
  }, [text]);

  return (
    <span className={styles.wrap}>
      <span ref={element} className={className} data-testid={testId}>
        {text}
      </span>
      {cut && (
        <span className={styles.tip} aria-hidden="true" data-testid={cutTextTestIds.tip}>
          {text}
        </span>
      )}
    </span>
  );
}
