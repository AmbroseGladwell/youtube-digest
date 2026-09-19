import type { Overview, OverviewState, Settings, StoredTranscript, Topic } from "@overview/types";
import type { AppLayout } from "../../src/app/LayoutContext.js";
import type { PlaybackPosition } from "../../src/app/PlaybackContext.js";
import type { Surface } from "../../src/app/SurfaceContext.js";
import type { ApiKeys } from "../../src/features/apiKeys/ApiKeys.js";

// Playwright Component Testing serializes props/hooksConfig across the Node<->browser
// boundary as plain JSON — a live store instance built in the Node test process can't
// survive that trip. Seed data goes in as plain objects instead; playwright/index.tsx's
// beforeMount hook builds the real (browser-side) in-memory stores from it, and writes
// apiKeys to localStorage the same way — page.addInitScript() only applies to a
// navigation that hasn't happened yet, which mount() doesn't reliably trigger.
export interface IwftHooksConfig {
  seedOverviews?: Overview[];
  seedStates?: OverviewState[];
  seedTopics?: Topic[];
  seedTranscripts?: StoredTranscript[];
  seedSettings?: Partial<Settings>;
  apiKeys?: ApiKeys;
  surface?: Surface;
  layout?: AppLayout;
  // Absent is a shell that can't see tabs; null is one that can, seeing no video.
  activeVideoUrl?: string | null;
  // Absent is a shell that can't see the player; null is one that can, with nothing to
  // report yet (docs/features/following-playback.md).
  playback?: PlaybackPosition | null;
  // Whether this shell has a page with an injected button on it
  // (docs/features/injected-button.md).
  runBridge?: boolean;
}
