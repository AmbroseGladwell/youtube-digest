import type { ProjectId } from "@overview/domain";

const KEY = "overview.projectNudgeKept";

type Kept = Record<string, string>;

const keyFor = (accountId: string | null) => `${KEY}.${accountId ?? "none"}`;

function readAll(accountId: string | null): Kept {
  try {
    const raw = localStorage.getItem(keyFor(accountId));
    const parsed: unknown = raw === null ? {} : JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Kept) : {};
  } catch {
    return {};
  }
}

// When the reader last chose Keep it on a project's quiet line, on this device.
export function readProjectNudgeKept(accountId: string | null, projectId: ProjectId): string | null {
  const value = readAll(accountId)[projectId];
  return typeof value === "string" ? value : null;
}

export function writeProjectNudgeKept(accountId: string | null, projectId: ProjectId, at: string): void {
  try {
    localStorage.setItem(keyFor(accountId), JSON.stringify({ ...readAll(accountId), [projectId]: at }));
  } catch {
    // Storage refused: the line comes back next visit, which is all it costs.
  }
}
