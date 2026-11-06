import { pluralise } from "./pluralise.js";

// "9h 47m", or "32m" under an hour: the figure as the library prints it.
export function formatTimeSaved(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${rest}m` : `${hours}h ${String(rest).padStart(2, "0")}m`;
}

// "9 hours 47 minutes": the same figure as a screen reader says it.
export function spokenTimeSaved(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return pluralise(rest, "minute", "minutes");
  }
  const spokenHours = pluralise(hours, "hour", "hours");
  return rest === 0 ? spokenHours : `${spokenHours} ${pluralise(rest, "minute", "minutes")}`;
}
