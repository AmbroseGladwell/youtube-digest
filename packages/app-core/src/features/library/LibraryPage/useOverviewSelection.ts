import { useEffect, useState } from "react";

// The library's select mode: the select button is the one way in ("OV-168 5" 168au). It ends
// when the place changes, so a selection never follows the reader to another project.
export function useOverviewSelection(placeKey: string) {
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [heldFor, setHeldFor] = useState(placeKey);

  if (heldFor !== placeKey) {
    setHeldFor(placeKey);
    setSelecting(false);
    setPicked(new Set());
  }

  const stop = () => {
    setSelecting(false);
    setPicked(new Set());
  };

  useEffect(() => {
    if (!selecting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && document.querySelector("dialog[open]") === null) stop();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selecting]);

  return {
    selecting,
    picked,
    start: () => setSelecting(true),
    stop,
    toggle: (id: string) =>
      setPicked((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    drop: (ids: string[]) =>
      setPicked((current) => {
        const next = new Set(current);
        for (const id of ids) next.delete(id);
        return next;
      }),
  };
}
