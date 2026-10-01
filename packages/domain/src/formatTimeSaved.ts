const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"}`;

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
    return plural(rest, "minute");
  }
  return rest === 0 ? plural(hours, "hour") : `${plural(hours, "hour")} ${plural(rest, "minute")}`;
}
