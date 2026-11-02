import { useEffect, type ReactNode } from "react";
import { useAccentMirror } from "../../app/AccentMirrorContext.js";
import { applyAppearance } from "./applyAppearance.js";
import { APPEARANCE_STORAGE_KEY, readAppearance, writeAppearance } from "./appearanceStorage.js";
import { useAppearance } from "./useAppearance.js";

export function AppearanceRuntime({ children }: { children: ReactNode }) {
  const { theme, accentColour } = useAppearance();
  const accentMirror = useAccentMirror();

  useEffect(() => {
    const appearance = { theme, accentColour };
    applyAppearance(appearance);
    writeAppearance(appearance);
    accentMirror?.(accentColour);
  }, [theme, accentColour, accentMirror]);

  useEffect(() => {
    const followAnotherTab = (event: StorageEvent) => {
      if (event.key === APPEARANCE_STORAGE_KEY) applyAppearance(readAppearance());
    };
    window.addEventListener("storage", followAnotherTab);
    return () => window.removeEventListener("storage", followAnotherTab);
  }, []);

  return children;
}
