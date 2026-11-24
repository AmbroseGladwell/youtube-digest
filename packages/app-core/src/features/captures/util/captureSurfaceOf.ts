import type { CaptureSurface } from "@overview/domain";
import type { Surface } from "../../../app/SurfaceContext.js";

const PHONE_WIDTH = "(max-width: 40rem)";

// Only ever shown back as where a link came from, so a narrow window counts as a phone.
export const captureSurfaceOf = (
  surface: Surface,
  matchMedia: ((query: string) => { matches: boolean }) | undefined = globalThis.matchMedia,
): CaptureSurface => {
  if (surface === "extension") {
    return "panel";
  }
  return matchMedia?.(PHONE_WIDTH).matches ? "phone" : "web";
};
