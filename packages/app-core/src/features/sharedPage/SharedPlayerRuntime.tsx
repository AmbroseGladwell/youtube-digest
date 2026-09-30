import { useEffect, useState, type ReactNode } from "react";
import { DEFAULT_NARRATION_VOICE, type SharedNarration } from "@overview/domain";
import { PlayerEngine } from "../player/PlayerEngine.js";
import { PlayerProvider } from "../player/PlayerContext.js";
import { sharedNarrationApi } from "./util/sharedNarrationApi.js";

// A player of its own, over the copy's own narration rather than the account's. It shadows
// the app-wide one for this route, which has none of the app's chrome and nothing playing
// behind it (docs/features/sharing.md).
export function SharedPlayerRuntime({
  narration,
  children,
}: {
  narration: SharedNarration | null;
  children: ReactNode;
}) {
  const [engine] = useState(
    () =>
      new PlayerEngine({
        api: sharedNarrationApi(narration),
        voice: narration?.voice ?? DEFAULT_NARRATION_VOICE,
        createMedia: () => new Audio(),
      }),
  );

  useEffect(() => () => engine.stop(), [engine]);

  return <PlayerProvider value={engine}>{children}</PlayerProvider>;
}
