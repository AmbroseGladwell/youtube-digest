import { useLayoutEffect, useRef, useState } from "react";
import { useLongPressTip } from "../../../util/useLongPressTip.js";
import styles from "./CutText.module.scss";
import { cutTextTestIds } from "./CutTextTestIds.js";

export interface CutTextProps {
  text: string;
  className: string | undefined;
  testId?: string;
}

// The tip is hidden from screen readers because the whole text is already in the page.
export const CutText = ({ text, className, testId }: CutTextProps) => {
  const element = useRef<HTMLSpanElement | null>(null);
  const [cut, setCut] = useState(false);
  const press = useLongPressTip(cut);

  useLayoutEffect(() => {
    const shown = element.current;
    if (shown === null) {
      return;
    }
    const measure = () => setCut(shown.scrollWidth > shown.clientWidth + 1 || shown.scrollHeight > shown.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(shown);
    return () => observer.disconnect();
  }, [text]);

  return (
    <span className={styles.wrap} {...press}>
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
};
