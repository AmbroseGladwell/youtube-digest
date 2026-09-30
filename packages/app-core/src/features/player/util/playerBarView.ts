import { narrationVoiceName, type NoteLine, formatClock } from "@overview/domain";
import type { PlayerSnapshot } from "../types/PlayerSnapshot.js";
import { sectionStartFractions } from "./estimatedLineStarts.js";
import { lineAtTime } from "./lineAtTime.js";

export type PlayerBarAction = "tryAgain" | "readAlongInstead" | "readAlong" | "readAlongMeanwhile" | "markRead" | "signIn";

export type PlayerMainButton = "play" | "pause" | "cancel" | "buffering" | "replay";

export interface PlayerBarView {
  // voiceLink: the rest names the voice, and is a way to Settings › Narration voice (43i).
  label: { lead: string; rest: string | null; tone: "ink" | "warning"; pacerTag: boolean; voiceLink?: boolean };
  clock: { inline: string; start: string; end: string };
  main: { kind: PlayerMainButton; label: string; disabled: boolean };
  skipEnabled: boolean;
  track: { fill: "progress" | "sweep" | "none"; percent: number; tone: "brand" | "stone"; thumb: boolean };
  notches: number[];
  seekable: boolean;
  actions: PlayerBarAction[];
  note: string | null;
  showRate: boolean;
  rateLabel: string;
  // Design 43j: "Re-record in Emma", for a note narrated before the reader chose Emma.
  reRecord: string | null;
}

export interface PlayerBarContext {
  read: boolean;
}

// The name the note itself prints over the section, which is what a listener sees: the
// Summary section is headed Premise.
export function sectionHeadingAt(lines: NoteLine[], index: number): string {
  for (let at = Math.min(index, lines.length - 1); at >= 0; at -= 1) {
    if (lines[at]!.heading) return lines[at]!.text;
  }
  return lines[0]?.section ?? "";
}

const aboutMinutes = (seconds: number) => `~${Math.max(1, Math.round(seconds / 60))} min`;

const rateLabelFor = (rate: number) => `${rate}×`;

// Design Player.dc.html section 1, one state per branch: what the bar says, which button
// sits in the middle, and what the track is doing. The label line is the live region.
export function playerBarView(
  snapshot: PlayerSnapshot,
  time: number,
  { read }: PlayerBarContext,
): PlayerBarView {
  const { track, status, source, pacerReason, availability, preparing, timings, rate, voice, narratedVoice } = snapshot;
  const lines = track?.lines ?? [];
  const section = sectionHeadingAt(lines, lineAtTime(timings.lineStarts, time));
  const duration = timings.durationSeconds;
  const percent = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
  const remaining = Math.max(0, duration - time);
  const notches = sectionStartFractions(lines, timings);
  const base: PlayerBarView = {
    label: { lead: "", rest: null, tone: "ink", pacerTag: false },
    clock: { inline: "", start: "", end: "" },
    main: { kind: "play", label: "Play", disabled: false },
    skipEnabled: true,
    track: { fill: "progress", percent, tone: "brand", thumb: true },
    notches,
    seekable: true,
    actions: [],
    note: null,
    showRate: true,
    rateLabel: rateLabelFor(rate),
    reRecord: null,
  };
  const reRecord =
    narratedVoice !== null && narratedVoice !== voice ? `Re-record in ${narrationVoiceName(voice)}` : null;

  if (source === "pacer") {
    const started = status !== "ready";
    const rest =
      pacerReason === "unavailable"
        ? "narration is unavailable right now"
        : status === "ended"
          ? "finished"
          : section;
    return {
      ...base,
      label: { lead: "Read-along · no audio", rest, tone: "ink", pacerTag: true },
      clock: started
        ? {
            inline: `~${formatClock(time)} · ${aboutMinutes(remaining)} left`,
            start: `~${formatClock(time)}`,
            end: aboutMinutes(remaining),
          }
        : { inline: aboutMinutes(duration), start: "", end: aboutMinutes(duration) },
      main: mainFor(status),
      track: { fill: started ? "progress" : "none", percent, tone: "stone", thumb: false },
      notches: [],
      seekable: false,
      actions: pacerReason === "signedOut" ? ["signIn"] : [],
    };
  }

  switch (status) {
    case "ready":
      if (availability === "checking") {
        return {
          ...base,
          label: { lead: "Listen", rest: `${narrationVoiceName(voice)} voice`, tone: "ink", pacerTag: false, voiceLink: true },
          clock: { inline: aboutMinutes(duration), start: "", end: aboutMinutes(duration) },
          skipEnabled: false,
          track: { ...base.track, fill: "none", thumb: false },
          notches: [],
          seekable: false,
        };
      }
      return availability === "ready"
        ? {
            ...base,
            label: {
              lead: "Narrated",
              rest: `${narrationVoiceName(narratedVoice ?? voice)} voice`,
              tone: "ink",
              pacerTag: false,
              voiceLink: true,
            },
            clock: { inline: formatClock(duration), start: formatClock(0), end: formatClock(duration) },
            skipEnabled: false,
            track: { ...base.track, fill: "none", thumb: false },
            seekable: false,
            reRecord,
          }
        : {
            ...base,
            label:
              availability === "preparing"
                ? {
                    lead: "Preparing audio",
                    rest: preparing?.step === "rendering" ? "Rendering" : "Queued",
                    tone: "ink",
                    pacerTag: false,
                  }
                : { lead: "Audio is made on first play", rest: "about 20 s", tone: "ink", pacerTag: false },
            clock: { inline: aboutMinutes(duration), start: "", end: aboutMinutes(duration) },
            skipEnabled: false,
            track: { ...base.track, fill: availability === "preparing" ? "sweep" : "none", thumb: false },
            notches: [],
            seekable: false,
          };

    case "preparing": {
      const long = preparing?.long ?? false;
      return {
        ...base,
        label: long
          ? { lead: "Still preparing", rest: "taking longer than usual", tone: "ink", pacerTag: false }
          : {
              lead: "Preparing audio",
              rest: preparing?.step === "rendering" ? "Rendering" : "Queued",
              tone: "ink",
              pacerTag: false,
            },
        clock: { inline: long ? "" : "Usually under 20 s", start: "", end: "" },
        main: { kind: "cancel", label: "Cancel preparing audio", disabled: false },
        skipEnabled: false,
        track: { ...base.track, fill: "sweep", thumb: false },
        notches: [],
        seekable: false,
        actions: long ? ["readAlongMeanwhile"] : [],
        note: long ? "Audio takes over at your line when it's ready." : null,
      };
    }

    case "failed":
    case "busy":
      return {
        ...base,
        label:
          status === "failed"
            ? { lead: "Couldn't prepare the audio", rest: null, tone: "warning", pacerTag: false }
            : {
                lead: "A few notes are already being prepared",
                rest: "try again when one finishes",
                tone: "ink",
                pacerTag: false,
              },
        main: { kind: "play", label: "Play", disabled: true },
        skipEnabled: false,
        track: { ...base.track, fill: "none", thumb: false },
        notches: [],
        seekable: false,
        actions: status === "failed" ? ["tryAgain", "readAlongInstead"] : ["readAlong"],
        showRate: false,
      };

    case "ended":
      return {
        ...base,
        label: { lead: "Finished", rest: null, tone: "ink", pacerTag: false },
        clock: { inline: formatClock(duration), start: formatClock(duration), end: formatClock(0) },
        main: mainFor(status),
        track: { ...base.track, percent: 100, thumb: false },
        actions: read ? [] : ["markRead"],
        reRecord,
      };

    default: {
      const lead =
        status === "playing" ? `Now playing · ${section}` : status === "paused" ? "Paused" : "Buffering";
      return {
        ...base,
        label: { lead, rest: status === "playing" ? null : section, tone: "ink", pacerTag: false },
        clock: {
          inline: `${formatClock(time)} · −${formatClock(remaining)}`,
          start: formatClock(time),
          end: `−${formatClock(remaining)}`,
        },
        main: mainFor(status),
        reRecord: status === "paused" ? reRecord : null,
      };
    }
  }
}

function mainFor(status: PlayerSnapshot["status"]): PlayerBarView["main"] {
  switch (status) {
    case "playing":
      return { kind: "pause", label: "Pause", disabled: false };
    case "buffering":
      return { kind: "buffering", label: "Pause, buffering", disabled: false };
    case "ended":
      return { kind: "replay", label: "Play again", disabled: false };
    default:
      return { kind: "play", label: "Play", disabled: false };
  }
}
