import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import styles from "./ChatSentence.module.scss";
import { chatSentenceTestIds } from "./ChatSentenceTestIds.js";

export interface ChatSentenceProps {
  index: number;
  current: boolean;
  choose: (sentence: number) => void;
  whole?: boolean;
  children: ReactNode;
}

const onLinkOrButton = (target: EventTarget): boolean => target instanceof Element && target.closest("a, button") !== null;

// A sentence of the answer being read, tapped to move the audio there, as the overview's lines are (OV-428).
export const ChatSentence = ({ index, current, choose, whole = false, children }: ChatSentenceProps) => {
  const tap = (event: MouseEvent) => {
    if (onLinkOrButton(event.target)) {
      return;
    }
    event.stopPropagation();
    choose(index);
  };
  const key = (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }
    event.preventDefault();
    choose(index);
  };
  const Tag = whole ? "div" : "span";
  return (
    <Tag
      role="button"
      tabIndex={0}
      className={`${styles.root} ${whole ? styles.whole : ""} ${current ? styles.current : ""}`}
      aria-current={current ? "true" : undefined}
      onClick={tap}
      onKeyDown={key}
      data-sentence={index}
      {...(current ? { "data-spoken": "" } : {})}
      data-testid={chatSentenceTestIds.root}
    >
      {children}
    </Tag>
  );
};
