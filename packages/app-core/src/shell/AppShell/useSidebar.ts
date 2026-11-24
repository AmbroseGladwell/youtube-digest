import { useEffect, useRef, useState, type RefObject } from "react";
import { useAnalytics } from "../../features/analytics/AnalyticsContext.js";
import { useMediaQuery } from "../../util/useMediaQuery.js";
import { readSidebarChoice, writeSidebarChoice } from "./sidebarStorage.js";

// Design 399f–399i: open by default from tablet landscape up, hidden below until asked for.
const OPENS_BY_DEFAULT_QUERY = "(min-width: 62rem)";

export type SidebarToggledBy = "button" | "key";

export interface Sidebar {
  available: boolean;
  open: boolean;
  shown: boolean;
  toggle: (by: SidebarToggledBy) => void;
  slot: RefObject<HTMLDivElement | null>;
  showButton: RefObject<HTMLButtonElement | null>;
}

const typingIn = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']") !== null;

// When it shows and how [ works: docs/features/navigation.md, "The sidebar".
export const useSidebar = (available: boolean): Sidebar => {
  const analytics = useAnalytics();
  const opensByDefault = useMediaQuery(OPENS_BY_DEFAULT_QUERY);
  const [choice, setChoice] = useState(readSidebarChoice);
  const open = choice === null ? opensByDefault : choice === "open";
  const slot = useRef<HTMLDivElement | null>(null);
  const showButton = useRef<HTMLButtonElement | null>(null);
  const focusAfter = useRef(false);

  const toggle = (by: SidebarToggledBy) => {
    const next = !open;
    focusAfter.current = by === "button";
    setChoice(next ? "open" : "hidden");
    writeSidebarChoice(next ? "open" : "hidden");
    analytics.app.sidebar.toggled({ open: next, by });
  };

  useEffect(() => {
    if (!focusAfter.current) {
      return;
    }
    focusAfter.current = false;
    (open ? slot.current?.querySelector<HTMLButtonElement>("button[aria-keyshortcuts]") : showButton.current)?.focus();
  }, [open]);

  useEffect(() => {
    if (!available) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "[" || event.metaKey || event.ctrlKey || event.altKey || typingIn(event.target)) {
        return;
      }
      if (document.querySelector("dialog[open], [role='dialog']") !== null) {
        return;
      }
      event.preventDefault();
      toggle("key");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return { available, open, shown: available && open, toggle, slot, showButton };
};
