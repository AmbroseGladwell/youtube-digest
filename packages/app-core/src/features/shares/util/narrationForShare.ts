import type { NarrationVoice, SharedNarration } from "@overview/domain";
import type { NarrationApi } from "@overview/sync";

// Narration the reader already has, in whichever voice it was made in. Nothing is queued:
// sharing an overview is not a reason to spend a render, and a copy without narration is a
// page that reads rather than one that also plays (docs/features/sharing.md).
export async function narrationForShare(
  api: NarrationApi | null,
  lines: string[],
  voice: NarrationVoice,
): Promise<SharedNarration | null> {
  if (api === null) {
    return null;
  }
  const found = await api.peek(lines, voice);
  if (found === null || found.render.status !== "ready") {
    return null;
  }
  return {
    key: found.render.key,
    voice: found.voice,
    durationSeconds: found.render.durationSeconds,
    lineStartsSeconds: found.render.lineStartsSeconds,
  };
}
