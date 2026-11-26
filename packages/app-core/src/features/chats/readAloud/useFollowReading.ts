import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useReadAloudSnapshot } from "./ReadAloudContext.js";

const SCROLL_KEYS = new Set(["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", " "]);

const reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

// Follows the sentence until the reader scrolls, then offers the way back (design 418m).
export const useFollowReading = (area: RefObject<HTMLElement | null>) => {
  const snapshot = useReadAloudSnapshot();
  const active = snapshot !== null && snapshot.status !== "idle";
  const answerKey = snapshot?.answer === null || snapshot === null ? null : `${snapshot.answer.chatId}#${snapshot.answer.message}`;
  const following = useRef(true);
  const [lost, setLost] = useState(false);

  const spokenIn = useCallback(() => area.current?.querySelector<HTMLElement>("[data-spoken]") ?? null, [area]);
  const show = useCallback(
    () => spokenIn()?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" }),
    [spokenIn],
  );

  useEffect(() => {
    following.current = true;
    setLost(false);
  }, [answerKey]);

  useEffect(() => {
    const element = area.current;
    if (element === null || !active) {
      return;
    }
    const scrolled = () => {
      if (following.current && spokenIn() !== null) {
        following.current = false;
        setLost(true);
      }
    };
    const keyed = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key) && event.target === element) {
        scrolled();
      }
    };
    element.addEventListener("wheel", scrolled, { passive: true });
    element.addEventListener("touchmove", scrolled, { passive: true });
    element.addEventListener("keydown", keyed);
    return () => {
      element.removeEventListener("wheel", scrolled);
      element.removeEventListener("touchmove", scrolled);
      element.removeEventListener("keydown", keyed);
    };
  }, [area, active, spokenIn]);

  useEffect(() => {
    if (active && following.current) {
      show();
    }
  }, [active, snapshot?.sentence, show]);

  const back = useCallback(() => {
    following.current = true;
    setLost(false);
    show();
  }, [show]);

  return { lost: lost && active, back };
};
