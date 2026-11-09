import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { joinInProse, MAX_ABOUT_YOU_SECTION_LENGTH, type AboutYouSection } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { ABOUT_YOU_SECTION_COPY, aboutYouSuggestionGroups, capitalised, type SuggestionGroup } from "../../util/aboutYouCopy.js";
import styles from "./AboutYouSheet.module.scss";
import { aboutYouSheetTestIds } from "./AboutYouSheetTestIds.js";

export interface AboutYouSheetProps {
  section: AboutYouSection;
  entries: readonly string[];
  topicNames: readonly string[];
  headingId: string;
  headingRef: Ref<HTMLHeadingElement>;
  onChange: (entries: string[]) => void;
  onDone: () => void;
}

const lengthWith = (entries: readonly string[], extra: string) => joinInProse(extra === "" ? entries : [...entries, extra]).length;

// Design 141h: what's in the section, then its suggestion groups, each ending with "Your own".
export function AboutYouSheet({ section, entries, topicNames, headingId, headingRef, onChange, onDone }: AboutYouSheetProps) {
  const copy = ABOUT_YOU_SECTION_COPY[section];
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const toggle = (entry: string) => onChange(entries.includes(entry) ? entries.filter((held) => held !== entry) : [...entries, entry]);

  return (
    <div className={styles.root} data-testid={aboutYouSheetTestIds.root}>
      <div className={styles.head}>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
          {copy.name}
        </h2>
        <p className={styles.help}>{copy.help} Not listed? Each group has its own "Your own".</p>
      </div>

      {entries.length > 0 && (
        <div className={styles.group}>
          <span className={styles.groupLabel}>In this section</span>
          <ul className={styles.chosenList}>
            {entries.map((entry) => (
              <li key={entry} className={styles.chosen} data-testid={aboutYouSheetTestIds.chosen(entry)}>
                <StrokeIcon name="check" size={14} />
                <span className={styles.chosenText}>{capitalised(entry)}</span>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Remove ${entry}`}
                  onClick={() => toggle(entry)}
                  data-testid={aboutYouSheetTestIds.remove(entry)}
                >
                  <StrokeIcon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {aboutYouSuggestionGroups(section, topicNames).map((group) => (
        <div key={group.name} className={styles.group} role="group" aria-label={group.name}>
          <span className={styles.groupLabel}>{group.name}</span>
          <div className={styles.chips}>
            {group.entries.map((entry) => {
              const held = entries.includes(entry);
              return (
                <button
                  key={entry}
                  type="button"
                  className={styles.chip}
                  aria-pressed={held}
                  disabled={!held && lengthWith(entries, entry) > MAX_ABOUT_YOU_SECTION_LENGTH}
                  data-entry={entry}
                  onClick={() => toggle(entry)}
                  data-testid={aboutYouSheetTestIds.suggestion(entry)}
                >
                  {held && <StrokeIcon name="check" size={14} />}
                  {capitalised(entry)}
                </button>
              );
            })}
            <YourOwn
              group={group}
              entries={entries}
              open={openGroup === group.name}
              onOpen={() => setOpenGroup(group.name)}
              onClose={() => setOpenGroup(null)}
              onAdd={(entry) => {
                if (!entries.includes(entry)) onChange([...entries, entry]);
              }}
            />
          </div>
        </div>
      ))}

      <div className={styles.foot}>
        {entries.length > 0 ? (
          <button type="button" className={styles.clear} onClick={() => onChange([])} data-testid={aboutYouSheetTestIds.clear}>
            Clear this section
          </button>
        ) : (
          <span />
        )}
        <button type="button" className={styles.done} onClick={onDone} data-testid={aboutYouSheetTestIds.done}>
          Done
        </button>
      </div>
    </div>
  );
}

interface YourOwnProps {
  group: SuggestionGroup;
  entries: readonly string[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onAdd: (entry: string) => void;
}

// A dashed chip that opens in place into a focused field; Enter adds, Escape folds it back
// and focus returns to the chip (141i).
function YourOwn({ group, entries, open, onOpen, onClose, onAdd }: YourOwnProps) {
  const [typed, setTyped] = useState("");
  const fieldId = useId();
  const countId = useId();
  const field = useRef<HTMLInputElement | null>(null);
  const chip = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) field.current?.focus();
    else if (wasOpen.current) chip.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        ref={chip}
        className={styles.ownChip}
        aria-expanded={false}
        aria-label={`Add your own: ${group.name}`}
        onClick={onOpen}
        data-testid={aboutYouSheetTestIds.ownOpen(group.name)}
      >
        <StrokeIcon name="plus" size={14} />
        Your own
      </button>
    );
  }

  const room = Math.max(0, MAX_ABOUT_YOU_SECTION_LENGTH - (lengthWith(entries, "x") - 1));
  const count = Math.min(MAX_ABOUT_YOU_SECTION_LENGTH, lengthWith(entries, typed));
  const full = typed.length >= room;
  const add = () => {
    const entry = typed.trim();
    if (entry === "") return;
    onAdd(entry);
    setTyped("");
    field.current?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div className={styles.own}>
      <div className={styles.ownField}>
        <label htmlFor={fieldId} className={styles.visuallyHidden}>
          Your own: {group.name}
        </label>
        <input
          id={fieldId}
          ref={field}
          name="about-you-entry"
          autoComplete="off"
          className={styles.ownInput}
          placeholder={`For example, ${group.example}`}
          value={typed}
          maxLength={room}
          aria-describedby={countId}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={onKeyDown}
          data-testid={aboutYouSheetTestIds.ownField}
        />
        <button
          type="button"
          className={styles.ownClose}
          aria-label="Close your own"
          onClick={onClose}
          data-testid={aboutYouSheetTestIds.ownClose}
        >
          <StrokeIcon name="close" size={14} />
        </button>
        <button
          type="button"
          className={styles.ownAdd}
          disabled={typed.trim() === ""}
          onClick={add}
          data-testid={aboutYouSheetTestIds.ownAdd}
        >
          Add
        </button>
      </div>
      <div id={countId} className={full ? styles.countFull : styles.count} aria-live="polite" data-testid={aboutYouSheetTestIds.ownCount}>
        <span className={styles.countLine}>
          {full && <StrokeIcon name="alert" size={13} />}
          {full ? "That's as long as a section gets. Trim something to add more." : "Enter adds it to this section. Escape closes."}
        </span>
        <span className={styles.countFigure}>
          {count} / {MAX_ABOUT_YOU_SECTION_LENGTH}
        </span>
      </div>
    </div>
  );
}
