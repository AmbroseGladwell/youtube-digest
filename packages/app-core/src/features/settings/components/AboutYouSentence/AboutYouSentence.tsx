import type { Ref } from "react";
import { ABOUT_YOU_SECTIONS, aboutYouSectionText, aboutYouSentence, type AboutYou, type AboutYouSection } from "@overview/domain";
import { ABOUT_YOU_SECTION_COPY } from "../../util/aboutYouCopy.js";
import styles from "./AboutYouSentence.module.scss";
import { aboutYouSentenceTestIds } from "./AboutYouSentenceTestIds.js";

export interface AboutYouSentenceProps {
  aboutYou: AboutYou;
  size: "hero" | "panel" | "card";
  openSection: AboutYouSection | null;
  settling: AboutYouSection | null;
  rising: boolean;
  sectionRef: (section: AboutYouSection) => Ref<HTMLButtonElement>;
  onOpen: (section: AboutYouSection) => void;
}

// Design 141a: a whole sentence at every step. An empty section holds a phrase that reads
// naturally, and a hidden status line repeats the sentence as it changes.
export function AboutYouSentence({ aboutYou, size, openSection, settling, rising, sectionRef, onOpen }: AboutYouSentenceProps) {
  const said = aboutYouSentence(aboutYou);
  return (
    <>
      <p className={`${styles.root} ${styles[size]} ${rising ? styles.rising : ""}`} data-testid={aboutYouSentenceTestIds.root}>
        {ABOUT_YOU_SECTIONS.map((section) => {
          const copy = ABOUT_YOU_SECTION_COPY[section];
          const text = aboutYouSectionText(section, aboutYou[section]);
          const state = openSection === section ? styles.open : text === "" ? styles.empty : styles.filled;
          return (
            <span key={section}>
              {copy.lead}
              <button
                type="button"
                ref={sectionRef(section)}
                className={`${styles.section} ${state} ${settling === section ? styles.settling : ""}`}
                aria-haspopup="dialog"
                aria-expanded={openSection === section}
                aria-label={`${copy.name}: ${text === "" ? "empty. Fill in." : `${text}. Edit.`}`}
                onClick={() => onOpen(section)}
                data-testid={aboutYouSentenceTestIds.section(section)}
              >
                {text === "" ? copy.empty : text}
              </button>
            </span>
          );
        })}
        .
      </p>
      <p className={styles.said} role="status">
        {said === "" ? "Your sentence is empty." : `Your sentence: ${said}`}
      </p>
    </>
  );
}
