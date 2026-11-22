import { startTransition, useId, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ClearFieldButton } from "../../../../components/shared/ClearFieldButton/ClearFieldButton.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./LibrarySearch.module.scss";
import { librarySearchTestIds } from "./LibrarySearchTestIds.js";

export interface LibrarySearchText {
  text: string;
  revision: number;
}

export interface LibrarySearchProps {
  text: LibrarySearchText;
  onType: (query: string) => void;
  onClearPressed: () => void;
  isPhone: boolean;
  placeholder: string;
  children: ReactNode;
}

// The field keeps what is typed and hands it on as a transition, so no key waits for the
// list (docs/features/library-view.md, "Search"). A new revision of `text` replaces it.
export function LibrarySearch({ text, onType, onClearPressed, isPhone, placeholder, children }: LibrarySearchProps) {
  const [query, setQuery] = useState(text.text);
  const [revision, setRevision] = useState(text.revision);
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const id = useId();

  if (text.revision !== revision) {
    setRevision(text.revision);
    setQuery(text.text);
  }

  const type = (next: string) => {
    setQuery(next);
    startTransition(() => onType(next));
  };

  const phoneSearch: "folded" | "open" | "kept" | undefined = !isPhone ? undefined : focused ? "open" : query !== "" ? "kept" : "folded";

  const openSearch = () => {
    flushSync(() => setFocused(true));
    input.current?.focus();
  };
  const closeSearch = () => {
    if (query !== "") {
      type("");
    }
    flushSync(() => setFocused(false));
    opener.current?.focus();
  };

  return (
    <div className={styles.root} data-search={phoneSearch}>
      <div className={styles.search}>
        {phoneSearch === "folded" && (
          <button
            type="button"
            ref={opener}
            className={styles.opener}
            onClick={openSearch}
            aria-label="Search"
            data-testid={librarySearchTestIds.openButton}
          >
            <StrokeIcon name="search" size={17} />
          </button>
        )}
        <span className={styles.icon} aria-hidden="true">
          <StrokeIcon name="search" size={16} />
        </span>
        <input
          ref={input}
          id={id}
          name="library-search"
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          className={styles.input}
          placeholder={placeholder}
          value={query}
          onChange={(event) => type(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && isPhone) {
              event.preventDefault();
              closeSearch();
            }
          }}
          tabIndex={phoneSearch === "folded" ? -1 : undefined}
          aria-label="Search overviews"
          data-testid={librarySearchTestIds.input}
        />
        {(phoneSearch === "open" || phoneSearch === "kept" || (!isPhone && query !== "")) && (
          <ClearFieldButton
            label={isPhone ? "Clear and close search" : "Clear search"}
            onClick={() => {
              onClearPressed();
              if (isPhone) {
                closeSearch();
              } else {
                type("");
              }
            }}
            testId={librarySearchTestIds.clearButton}
          />
        )}
      </div>
      <div className={styles.controls} inert={phoneSearch === "open"}>
        {children}
      </div>
    </div>
  );
}
