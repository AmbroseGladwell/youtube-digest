import type { NarrationRender, SharedNarration } from "@overview/domain";
import type { NarrationApi } from "@overview/sync";

// Why a visitor hears it without an account: docs/features/sharing.md, "Audio without an account".
export const sharedNarrationApi = (narration: SharedNarration | null): NarrationApi | null => {
  if (narration === null) {
    return null;
  }
  const render: NarrationRender = {
    key: narration.key,
    status: "ready",
    lineStartsSeconds: narration.lineStartsSeconds,
    durationSeconds: narration.durationSeconds,
    fileUrl: `/api/audio/${narration.key}/file`,
  };
  const found = { voice: narration.voice, render };

  return {
    peek: () => Promise.resolve(found),
    request: () => Promise.resolve(render),
    status: () => Promise.resolve(render),
    discard: () => Promise.resolve(),
    samples: () => Promise.resolve([]),
    // The page is served by the process that serves the file, so the path is the URL.
    fileUrl: ({ fileUrl }) => fileUrl,
  };
};
