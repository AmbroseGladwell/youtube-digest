export type ListenSide = "A" | "B" | "tie";
export type ListenPreference = "old" | "new" | "tie";

export interface ListenPick {
  videoId: string;
  title: string;
  newWasA: boolean;
  side: ListenSide;
  preferred: ListenPreference;
  reason: string;
  oldSeconds: number;
  newSeconds: number;
  pickedAt: string;
}
