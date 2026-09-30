import type { NarrationRender, SharedNarration } from "@overview/domain";
import type { NarrationApi } from "@overview/sync";

// The shared copy's own narration, presented as the narration API the player already
// speaks. Nothing is asked of the server and nothing can be queued: the render exists, its
// file is public and content-addressed, and a visitor hears it without an account. This is
// the departure from OV-40 1k, where a signed-out reader gets the pacer
// (docs/features/sharing.md).
//
// A copy shared without narration gets null, and the player falls back to the pacer as it
// does for any signed-out reader.
export function sharedNarrationApi(narration: SharedNarration | null): NarrationApi | null {
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
}
