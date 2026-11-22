import type { NarrationVoice, SharedNarration } from "@overview/domain";
import type { NarrationApi } from "@overview/sync";

// Nothing is queued: sharing an overview is not a reason to spend a render.
export const narrationForShare = async (
  api: NarrationApi | null,
  lines: string[],
  voice: NarrationVoice,
): Promise<SharedNarration | null> => {
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
};
