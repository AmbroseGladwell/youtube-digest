import type { TimerSound } from "@overview/domain";

export const TIMER_SOUND_LABELS: Record<TimerSound, { name: string; line: string }> = {
  ready: { name: "Ready", line: "A rising marimba call over soft strings. The default" },
  chime: { name: "Chime", line: "Two glass-like notes" },
  lowTone: { name: "Low tone", line: "One warm, low note that slowly shimmers" },
  rise: { name: "Rise", line: "Bright notes climbing a chord, for a loud kitchen" },
  marimba: { name: "Marimba", line: "A warm wooden call, for a loud kitchen" },
  pulse: { name: "Pulse", line: "Steady pairs of soft piano notes, for a loud kitchen" },
  crystal: { name: "Crystal", line: "One pure ring, like a wine glass" },
  musicBox: { name: "Music box", line: "A little phrase on steel tines" },
  vibraphone: { name: "Vibraphone", line: "Two soft notes, like a polite doorbell" },
  harp: { name: "Harp", line: "A quick sweep up the strings" },
};
