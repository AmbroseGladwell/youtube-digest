import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type Ref } from "react";
import { ABOUT_YOU_SECTIONS, type AboutYou, type AboutYouSection } from "@overview/domain";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { flyEntriesInto, measureEntries } from "../../util/flyEntriesInto.js";
import { AboutYouSentence } from "../AboutYouSentence/AboutYouSentence.js";
import { AboutYouSheet } from "../AboutYouSheet/AboutYouSheet.js";
import styles from "./AboutYouEditor.module.scss";
import { aboutYouEditorTestIds } from "./AboutYouEditorTestIds.js";

const sameEntries = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((entry, index) => entry === b[index]);

export interface AboutYouEditorProps {
  aboutYou: AboutYou;
  size: "hero" | "card";
  topicNames: readonly string[];
  onChange: (section: AboutYouSection, entries: string[]) => void;
  onSheetOpen?: (open: boolean) => void;
}

// The sentence and its sheet, the same in onboarding and Settings. Wide, the sheet is a
// popover under the sentence; on a phone, a bottom sheet; in the panel it takes the panel
// over (designs 141b, 141g). The sentence reads the sheet's picks as they're made. Every way
// out commits them; Done, Escape and Back hand focus back to the section, while a click or tab
// away from the popover leaves focus where it went. A click away commits on press but closes
// on click, so the popover's going doesn't move what was clicked out from under the pointer.
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
  const finished = useRef<AboutYouSection | null>(null);
  const opened = useRef<readonly string[]>([]);

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
    popover.current?.scrollIntoView({ block: "nearest" });
    heading.current?.focus();
  }, [open, onSheetOpen]);

  const start = (section: AboutYouSection) => {
    if (open === section) {
      finish();
      return;
    }
    finished.current = null;
    opened.current = aboutYou[section];
    setDraft(aboutYou[section]);
    setOpen(section);
  };

  const commit = () => {
    if (open === null || sameEntries(draft, aboutYou[open])) return;
    onChange(open, draft);
  };

  const finish = ({ refocus = true } = {}) => {
    if (open === null || finished.current === open) return;
    finished.current = open;
    const section = open;
    const before = opened.current;
    const added = draft.filter((entry) => !before.includes(entry));
    const flights = measureEntries(dialog.current ?? popover.current, added);
    const changed = !sameEntries(draft, before);
    const next = { ...aboutYou, [section]: draft };
    const filledLast = before.length === 0 && ABOUT_YOU_SECTIONS.every((candidate) => next[candidate].length > 0);
    commit();
    dialog.current?.close();
    setOpen(null);
    const button = sectionButtons.current.get(section);
    if (refocus) button?.focus();
    if (!changed) return;
    if (button !== undefined) flyEntriesInto(flights, button);
    setSettling(section);
    setRising(filledLast);
    window.setTimeout(() => {
      setSettling(null);
      setRising(false);
    }, 300);
  };

  const latest = useRef({ commit, finish });
  latest.current = { commit, finish };
  const pointerDown = useRef(false);
  const pressedOutside = useRef(false);

  useEffect(() => {
    if (open === null || modal) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      pointerDown.current = true;
      pressedOutside.current = !popover.current?.contains(target) && !sectionButtons.current.get(open)?.contains(target);
      if (pressedOutside.current) latest.current.commit();
    };
    const onPointerUp = () => {
      pointerDown.current = false;
    };
    const onClick = () => {
      if (pressedOutside.current) latest.current.finish({ refocus: false });
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerUp, true);
    document.addEventListener("click", onClick);
    return () => {
      pointerDown.current = false;
      pressedOutside.current = false;
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerUp, true);
      document.removeEventListener("click", onClick);
    };
  }, [open, modal]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      finish();
    }
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const to = event.relatedTarget;
    if (to === null || event.currentTarget.contains(to) || (open !== null && to === sectionButtons.current.get(open))) return;
    if (pointerDown.current) commit();
    else finish({ refocus: false });
  };

  const sheet = open !== null && (
    <AboutYouSheet
      section={open}
      entries={draft}
      topicNames={topicNames}
      headingId={headingId}
      headingRef={heading}
      onChange={setDraft}
      onDone={() => finish()}
    />
  );

  return (
    <>
      <AboutYouSentence
        aboutYou={open === null ? aboutYou : { ...aboutYou, [open]: draft }}
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
          onBlur={onBlur}
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
            <button
              type="button"
              className={styles.panelBack}
              aria-label="Back to your sentence"
              onClick={() => finish()}
              data-testid={aboutYouEditorTestIds.panelBack}
            >
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
