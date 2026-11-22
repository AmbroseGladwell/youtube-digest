import { useEffect, useMemo, useState } from "react";
import type { PlaybackFrom } from "@overview/domain";
import { usePlayer, usePlayerLine, usePlayerSnapshot, usePlayerTime } from "../../player/PlayerContext.js";
import type { PlayerSnapshot } from "../../player/types/PlayerSnapshot.js";
import type { PlayerTrack } from "../../player/types/PlayerTrack.js";
import { estimatedLineStarts } from "../../player/util/estimatedLineStarts.js";

export interface NotePlayer {
  current: boolean;
  snapshot: PlayerSnapshot;
  time: number;
  activeIndex: number;
  playing: boolean;
  selectLine: (index: number) => void;
  selectSection: (section: string) => void;
  stepLine: (delta: number) => void;
  main: (from: PlaybackFrom) => void;
  play: (from: PlaybackFrom) => void;
  pause: () => void;
}

const isBusyElsewhere = (snapshot: PlayerSnapshot) =>
  snapshot.track !== null && snapshot.docked && snapshot.status !== "ready" && snapshot.status !== "ended";

// When a note takes the player over: docs/features/audio-player.md, "Which note the bar is about".
export const useNotePlayer = (track: PlayerTrack | null): NotePlayer => {
  const engine = usePlayer();
  const snapshot = usePlayerSnapshot();
  const time = usePlayerTime();
  const engineLine = usePlayerLine();
  const [restingLine, setRestingLine] = useState(0);
  const current = track !== null && snapshot.track?.overviewId === track.overviewId;

  useEffect(() => setRestingLine(0), [track?.overviewId]);

  const overviewId = track?.overviewId ?? null;
  useEffect(() => {
    if (overviewId === null) {
      return;
    }
    engine.notePageOpened(overviewId);
    return () => engine.notePageClosed(overviewId);
  }, [engine, overviewId]);

  useEffect(() => {
    if (track !== null && !isBusyElsewhere(engine.getSnapshot())) {
      engine.load(track);
    }
  }, [engine, track]);

  const preview = useMemo<PlayerSnapshot>(
    () => ({
      ...snapshot,
      track,
      status: "ready",
      source: engine.canNarrate() ? "audio" : "pacer",
      pacerReason: engine.canNarrate() ? null : "signedOut",
      availability: "checking",
      preparing: null,
      timings: estimatedLineStarts(track?.lines ?? []),
    }),
    [snapshot, track, engine],
  );

  const takeOver = () => {
    if (track !== null && !current) {
      engine.load(track, restingLine);
    }
  };
  const lines = track?.lines ?? [];
  const activeIndex = current ? engineLine : restingLine;
  const clampLine = (index: number) => Math.min(Math.max(index, 0), Math.max(lines.length - 1, 0));
  const selectLine = (index: number) => {
    if (current) {
      engine.seekLine(index);
    } else {
      setRestingLine(clampLine(index));
    }
  };

  return {
    current,
    snapshot: current ? snapshot : preview,
    time: current ? time : (preview.timings.lineStarts[restingLine] ?? 0),
    activeIndex,
    playing: current && (snapshot.status === "playing" || snapshot.status === "buffering"),
    selectLine,
    selectSection: (section) => {
      const index = lines.findIndex((line) => line.section === section);
      if (index !== -1) {
        selectLine(index);
      }
    },
    stepLine: (delta) => selectLine(activeIndex + delta),
    main: (from) => {
      takeOver();
      engine.toggle(from);
    },
    play: (from) => {
      takeOver();
      engine.play(from);
    },
    pause: () => {
      if (current) {
        engine.pause();
      }
    },
  };
};
