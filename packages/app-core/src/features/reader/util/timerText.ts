import type { CookingTimer } from "./cookingTimers.js";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const COUNT_WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

export const countWord = (count: number): string => COUNT_WORDS[count] ?? String(count);

export function timerClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

export function timerLength(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes}`;
}

export function timerLengthWords(seconds: number): string {
  if (seconds < 60) return `${seconds}-second`;
  if (seconds % 3600 === 0) return `${seconds / 3600}-hour`;
  return `${Math.round(seconds / 60)}-minute`;
}

export function timeLeftWords(ms: number): string {
  if (ms < 60_000) return plural(Math.max(1, Math.ceil(ms / 1000)), "second");
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return plural(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? plural(hours, "hour") : `${plural(hours, "hour")} ${plural(minutes % 60, "minute")}`;
}

export const timerAgo = (ms: number): string =>
  ms < 10_000 ? "just now" : ms < 60_000 ? `${Math.floor(ms / 1000)} s ago` : `${Math.floor(ms / 60_000)} min ago`;

export const timerShortName = (timer: CookingTimer): string => timer.name ?? `Step ${timer.step + 1}`;

export const timerFullName = (timer: CookingTimer): string =>
  timer.name === null ? `Step ${timer.step + 1} timer` : `${timer.name} · step ${timer.step + 1}`;

export const timerSpokenName = (timer: CookingTimer): string =>
  timer.name === null ? `Step ${timer.step + 1} timer` : `${timer.name} timer`;

export const timerAtClock = (at: number): string =>
  new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
