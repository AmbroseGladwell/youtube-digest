import { z } from "zod";

export const TimerSound = z.enum(["ready", "chime", "lowTone", "rise", "marimba", "pulse", "crystal", "musicBox", "vibraphone", "harp"]);
export type TimerSound = z.infer<typeof TimerSound>;

export const DEFAULT_TIMER_SOUND: TimerSound = "ready";
