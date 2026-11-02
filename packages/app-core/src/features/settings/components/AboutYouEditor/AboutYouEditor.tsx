import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { ABOUT_YOU_SECTIONS, type AboutYou, type AboutYouSection } from "@overview/domain";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { flyEntriesInto, measureEntries } from "../../util/flyEntriesInto.js";
import { AboutYouSentence } from "../AboutYouSentence/AboutYouSentence.js";
import { AboutYouSheet } from "../AboutYouSheet/AboutYouSheet.js";
import styles from "./AboutYouEditor.module.scss";
import { aboutYouEditorTestIds } from "./AboutYouEditorTestIds.js";

export interface AboutYouEditorProps {
  aboutYou: AboutYou;
  size: "hero" | "card";
  topicNames: readonly string[];
  onChange: (section: AboutYouSection, entries: string[]) => void;
  onSheetOpen?: (open: boolean) => void;
}

// The sentence and its sheet, the same in onboarding and Settings. Wide, the sheet is a
// popover under the sentence; on a phone, a bottom sheet; in the panel it takes the panel
// over (designs 141b, 141g). Done or Escape hands focus back to the section it came from.
export function AboutYouEditor({ aboutYou, size, topicNames, onChange, onSheetOpen }: AboutYouEditorProps) {
  const isPanel = useIsPanel();
  const isPhone = useIsPhone();
  const [open, setOpen] = useState<AboutYouSection | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [settling, setSettling] = useState<AboutYouSection | null>(null);
  const [rising, setRising] = useState(false);
  const sectionButtons = useRef(new Map<AboutYouSection, HTMLButtonElement>());
  const heading = useRef<HTMLHeadingElement | null>(null);
  const headingId = useId();
  const dialog = useRef<HTMLDialogElement | null>(null);
  const popover = useRef<HTMLDivElement | null>(null);
  const modal = isPanel || isPhone;

  const sectionRef = useCallback(
    (section: AboutYouSection): Ref<HTMLButtonElement> =>
      (button) => {
        if (button === null) sectionButtons.current.delete(section);
        else sectionButtons.current.set(section, button);
      },
    [],
  );

  useEffect(() => {
    onSheetOpen?.(open !== null);
    if (open === null) return;
    const element = dialog.current;
    if (element !== null && !element.open) element.showModal();
    heading.current?.focus();
  }, [open, onSheetOpen]);

  const start = (section: AboutYouSection) => {
    setDraft(aboutYou[section]);
    setOpen(section);
  };

  const finish = () => {
    if (open === null) return;
    const section = open;
    const added = draft.filter((entry) => !aboutYou[section].includes(entry));
    const flights = measureEntries(dialog.current ?? popover.current, added);
    const changed = draft.length !== aboutYou[section].length || added.length > 0;
    const next = { ...aboutYou, [section]: draft };
    const filledLast = aboutYou[section].length === 0 && ABOUT_YOU_SECTIONS.every((candidate) => next[candidate].length > 0);
    if (changed) onChange(section, draft);
    dialog.current?.close();
    setOpen(null);
    const button = sectionButtons.current.get(section);
    button?.focus();
    if (!changed) return;
    if (button !== undefined) flyEntriesInto(flights, button);
    setSettling(section);
    setRising(filledLast);
    window.setTimeout(() => {
      setSettling(null);
      setRising(false);
    }, 300);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      finish();
    }
  };

  const sheet = open !== null && (
    <AboutYouSheet
      section={open}
      entries={draft}
      topicNames={topicNames}
      headingId={headingId}
      headingRef={heading}
      onChange={setDraft}
      onDone={finish}
    />
  );

  return (
    <>
      <AboutYouSentence
        aboutYou={aboutYou}
        size={size === "hero" && isPanel ? "panel" : size}
        openSection={open}
        settling={settling}
        rising={rising}
        sectionRef={sectionRef}
        onOpen={start}
      />
      {open !== null && !modal && (
        <div
          ref={popover}
          className={styles.popover}
          role="dialog"
          aria-labelledby={headingId}
          onKeyDown={onKeyDown}
          data-testid={aboutYouEditorTestIds.sheet}
        >
          {sheet}
        </div>
      )}
      {open !== null && modal && (
        <dialog
          ref={dialog}
          className={isPanel ? styles.takeover : styles.bottomSheet}
          aria-labelledby={headingId}
          onCancel={(event) => {
            event.preventDefault();
            finish();
          }}
          data-testid={aboutYouEditorTestIds.sheet}
        >
          {isPanel ? (
            <button type="button" className={styles.panelBack} aria-label="Back to your sentence" onClick={finish} data-testid={aboutYouEditorTestIds.panelBack}>
              <StrokeIcon name="arrowLeft" size={18} />
              <span>Your sentence</span>
            </button>
          ) : (
            <span className={styles.handle} aria-hidden="true" />
          )}
          {sheet}
        </dialog>
      )}
    </>
  );
}
