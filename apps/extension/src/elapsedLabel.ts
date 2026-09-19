// The content script cannot import app-core's formatClock: everything in that package
// reaches the page through its index, which starts at React. Four lines on this side of
// that boundary beats a shared package for one clock
// (docs/features/injected-button.md).
export function elapsedLabel(startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
