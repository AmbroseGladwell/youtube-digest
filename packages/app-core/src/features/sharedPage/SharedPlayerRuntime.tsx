import { useEffect, useState, type ReactNode } from "react";
import { DEFAULT_NARRATION_VOICE, type SharedNarration } from "@overview/domain";
import { PlayerEngine } from "../player/PlayerEngine.js";
import { PlayerProvider } from "../player/PlayerContext.js";
import { sharedNarrationApi } from "./util/sharedNarrationApi.js";

export interface SharedPlayerRuntimeProps {
  narration: SharedNarration | null;
  children: ReactNode;
}

// Shadows the app-wide player: this route has none of the app's chrome and nothing playing behind it.
export const SharedPlayerRuntime = ({ narration, children }: SharedPlayerRuntimeProps) => {
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
};
