const unit = (count: number, singular: string) => `${count} ${singular}${count === 1 ? "" : "s"}`;

export function spokenDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [hours > 0 ? unit(hours, "hour") : null, minutes > 0 ? unit(minutes, "minute") : null];
  const named = parts.filter((part) => part !== null);
  if (named.length === 0) {
    return unit(seconds, "second");
  }
  if (seconds === 0) {
    return named.join(" ");
  }
  return minutes > 0 ? [...named, String(seconds)].join(" ") : `${named.join(" ")} and ${unit(seconds, "second")}`;
}
