import { narrationVoiceName, type NoteLine, formatClock } from "@overview/domain";
import type { PlayerSnapshot } from "../types/PlayerSnapshot.js";
import { sectionStartFractions } from "./estimatedLineStarts.js";
import { lineAtTime } from "./lineAtTime.js";
import { HELD_LEAD_SECONDS } from "../PlayerEngine.js";

export type PlayerBarAction = "tryAgain" | "readAlongInstead" | "readAlong" | "readAlongMeanwhile" | "markRead" | "signIn";

export type PlayerMainButton = "play" | "pause" | "cancel" | "starting" | "buffering" | "replay";

export interface PlayerBarView {
  // quietRest: a countdown on screen that the live region must not read out each time it changes.
  label: { lead: string; rest: string | null; tone: "ink" | "warning"; pacerTag: boolean; voiceLink?: boolean; quietRest?: boolean };
  clock: { inline: string; start: string; end: string };
  main: { kind: PlayerMainButton; label: string; disabled: boolean };
  skipEnabled: boolean;
  track: {
    fill: "progress" | "sweep" | "none";
    percent: number;
    tone: "brand" | "stone";
    thumb: boolean;
    made?: number;
    gap?: [from: number, to: number];
    ring?: boolean;
  };
  lengthKnown: boolean;
  back: string | null;
  notches: number[];
  seekable: boolean;
  actions: PlayerBarAction[];
  note: string | null;
  showRate: boolean;
  rateLabel: string;
  reRecord: string | null;
}

export interface PlayerBarContext {
  read: boolean;
}

// The heading the note prints, not the section's key: the Summary section is headed Premise.
export const sectionHeadingAt = (lines: NoteLine[], index: number): string => {
  for (let at = Math.min(index, lines.length - 1); at >= 0; at -= 1) {
    if (lines[at]!.heading) {
      return lines[at]!.text;
    }
  }
  return lines[0]?.section ?? "";
};

const aboutMinutes = (seconds: number) => `~${Math.max(1, Math.round(seconds / 60))} min`;

const rateLabelFor = (rate: number) => `${rate}×`;

const pacerRestOf = (pacerReason: PlayerSnapshot["pacerReason"], status: PlayerSnapshot["status"], section: string): string => {
  if (pacerReason === "unavailable") {
    return "narration is unavailable right now";
  }
  if (pacerReason === "dailyCap") {
    return "you’ve started today’s new narration, more tomorrow";
  }
  return status === "ended" ? "finished" : section;
};

const liveLeadOf = (status: PlayerSnapshot["status"], section: string): string => {
  if (status === "playing") {
    return `Now playing · ${section}`;
  }
  return status === "paused" ? "Paused" : "Buffering";
};

// One branch per state in docs/features/audio-player.md, "The states".
export const playerBarView = (snapshot: PlayerSnapshot, time: number, { read }: PlayerBarContext): PlayerBarView => {
  const { track, status, source, pacerReason, availability, preparing, timings, rate, voice, narratedVoice } = snapshot;
  const lines = track?.lines ?? [];
  const inOpening = time < (timings.lineStarts[0] ?? 0);
  const section = inOpening && track !== null ? track.title : sectionHeadingAt(lines, lineAtTime(timings.lineStarts, time));
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
    lengthKnown: true,
    back: null,
  };
  const reRecord = narratedVoice !== null && narratedVoice !== voice ? `Re-record in ${narrationVoiceName(voice)}` : null;

  if (source === "pacer") {
    const started = status !== "ready";
    const rest = pacerRestOf(pacerReason, status, section);
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
      if (snapshot.source === "audio") {
        return startingView(base, duration);
      }
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
      if (snapshot.stream !== null) {
        return streamingView(base, snapshot, time, section);
      }
      const lead = liveLeadOf(status, section);
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
};

// 42a: lighter than 1c, it replaces 1c and 1d on a first play.
const startingView = (base: PlayerBarView, duration: number): PlayerBarView => ({
  ...base,
  label: { lead: "Starting", rest: null, tone: "ink", pacerTag: false },
  clock: { inline: aboutMinutes(duration), start: "", end: aboutMinutes(duration) },
  main: { kind: "starting", label: "Pause, starting", disabled: false },
  skipEnabled: false,
  track: { ...base.track, fill: "none", thumb: false },
  notches: [],
  seekable: false,
  lengthKnown: false,
});

const secondsUntilHeld = ({ stream, timings }: PlayerSnapshot): number | null => {
  if (stream === null || stream.holdingLine === null || stream.renderPace === null) {
    return null;
  }
  const needed = (timings.lineStarts[stream.holdingLine] ?? 0) + HELD_LEAD_SECONDS - stream.renderedSeconds;
  return Math.max(1, Math.ceil(needed / stream.renderPace));
};

// 42b to 42d: playback ahead of the render, the same bar with a made-so-far fill and an estimated length.
const streamingView = (base: PlayerBarView, snapshot: PlayerSnapshot, time: number, section: string): PlayerBarView => {
  const { status, timings, track } = snapshot;
  const stream = snapshot.stream!;
  const duration = timings.durationSeconds;
  const at = (seconds: number) => (duration > 0 ? Math.min(100, (seconds / duration) * 100) : 0);
  const made = at(stream.renderedSeconds);
  const clock = {
    inline: `${formatClock(time)} · ${aboutMinutes(duration)}`,
    start: formatClock(time),
    end: aboutMinutes(duration),
  };
  const notches = base.notches.filter((fraction) => fraction * duration <= stream.renderedSeconds);
  if (stream.holdingLine !== null) {
    const wait = secondsUntilHeld(snapshot);
    return {
      ...base,
      label: {
        lead: `Preparing from ${sectionHeadingAt(track?.lines ?? [], stream.holdingLine)}`,
        rest: wait === null ? null : `~${wait} s`,
        tone: "ink",
        pacerTag: false,
        quietRest: true,
      },
      clock,
      main: { kind: "buffering", label: "Pause, preparing", disabled: false },
      track: { ...base.track, made, gap: [made, base.track.percent], ring: true },
      notches,
      lengthKnown: false,
      back: stream.holdingFrom === null ? null : `Back to ${formatClock(stream.holdingFrom)}`,
    };
  }
  return {
    ...base,
    label: { lead: liveLeadOf(status, section), rest: status === "playing" ? null : section, tone: "ink", pacerTag: false },
    clock,
    main: mainFor(status),
    track: { ...base.track, made },
    notches,
    lengthKnown: false,
  };
};

const mainFor = (status: PlayerSnapshot["status"]): PlayerBarView["main"] => {
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
};
