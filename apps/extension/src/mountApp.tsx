import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter } from "react-router";
import {
  App,
  createAppRouter,
  type ActiveVideoSource,
  type AppLayout,
  type PlaybackSource,
} from "@overview/app-core";
import {
  IndexedDbOverviewStore,
  IndexedDbSettingsStore,
  IndexedDbTranscriptStore,
  openLocalDatabase,
} from "@overview/store-local";

export interface MountOptions {
  layout?: AppLayout;
  activeVideo?: ActiveVideoSource | null;
  playback?: PlaybackSource | null;
}

// A hash router, not a browser one: an extension document is a packaged file, so a pushed
// path like /overviews/<id> resolves to nothing and the panel 404s on reload.
export async function mountApp({
  layout = "full",
  activeVideo = null,
  playback = null,
}: MountOptions = {}): Promise<void> {
  const container = document.getElementById("root");
  if (!container) throw new Error("the extension document is missing its #root element");

  const db = await openLocalDatabase();
  const overviewStore = new IndexedDbOverviewStore(db);
  const settingsStore = new IndexedDbSettingsStore(db);
  const transcriptStore = new IndexedDbTranscriptStore(db);

  createRoot(container).render(
    <StrictMode>
      <App
        stores={{ overviewStore, settingsStore, transcriptStore }}
        router={createAppRouter(createHashRouter)}
        surface="extension"
        layout={layout}
        activeVideo={activeVideo}
        playback={playback}
      />
    </StrictMode>,
  );
}
