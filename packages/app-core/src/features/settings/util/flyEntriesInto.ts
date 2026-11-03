import { prefersReducedMotion } from "../../../util/prefersReducedMotion.js";
import styles from "./flyEntriesInto.module.scss";

export interface EntryFlight {
  text: string;
  from: DOMRect;
}

export function measureEntries(sheet: HTMLElement | null, entries: readonly string[]): EntryFlight[] {
  if (sheet === null) return [];
  return entries.flatMap((text) => {
    const chip = Array.from(sheet.querySelectorAll<HTMLElement>("[data-entry]")).find((element) => element.dataset.entry === text);
    return chip === undefined ? [] : [{ text: chip.textContent ?? text, from: chip.getBoundingClientRect() }];
  });
}

// Design 141i: each new entry lifts from the closing sheet and travels to its section. A
// copy on the document, because the sheet it left is already gone.
export function flyEntriesInto(flights: readonly EntryFlight[], section: HTMLElement): void {
  if (prefersReducedMotion()) return;
  const to = section.getBoundingClientRect();
  for (const { text, from } of flights) {
    const ghost = document.createElement("span");
    ghost.className = styles.ghost!;
    ghost.textContent = text;
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.left = `${from.left}px`;
    ghost.style.top = `${from.top}px`;
    document.body.append(ghost);
    const flight = ghost.animate(
      [
        { transform: "translate(0, 0)", opacity: 1 },
        { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px)`, opacity: 0 },
      ],
      { duration: 240, easing: "ease-out" },
    );
    flight.onfinish = () => ghost.remove();
    flight.oncancel = () => ghost.remove();
  }
}
