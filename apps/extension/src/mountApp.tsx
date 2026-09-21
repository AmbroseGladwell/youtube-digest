import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter } from "react-router";
import {
  App,
  createAppRouter,
  type ActiveVideoSource,
  type AppLayout,
  type PlaybackSource,
  type RunBridge,
  type YouTubeFetch,
  OutOfDateTab,
  StartupFailure,
} from "@overview/app-core";
import {
  IndexedDbOverviewStore,
  IndexedDbSettingsStore,
  LocalDatabaseBlockedError,
  IndexedDbTranscriptStore,
  openLocalDatabase,
} from "@overview/store-local";

export interface MountOptions {
  layout?: AppLayout;
  activeVideo?: ActiveVideoSource | null;
  playback?: PlaybackSource | null;
  runBridge?: RunBridge | null;
  youTubeFetch?: YouTubeFetch | null;
}

// A hash router, not a browser one: an extension document is a packaged file, so a pushed
// path like /overviews/<id> resolves to nothing and the panel 404s on reload.
export async function mountApp({
  layout = "full",
  activeVideo = null,
  playback = null,
  runBridge = null,
  youTubeFetch = null,
}: MountOptions = {}): Promise<void> {
  const container = document.getElementById("root");
  if (!container) throw new Error("the extension document is missing its #root element");

  const root = createRoot(container);

  let db: IDBDatabase;
  try {
    db = await openLocalDatabase({ onSuperseded: () => root.render(<OutOfDateTab />) });
  } catch (error) {
    console.error(error);
    root.render(<StartupFailure blocked={error instanceof LocalDatabaseBlockedError} />);
    return;
  }

  const overviewStore = new IndexedDbOverviewStore(db);
  const settingsStore = new IndexedDbSettingsStore(db);
  const transcriptStore = new IndexedDbTranscriptStore(db);

  root.render(
    <StrictMode>
      <App
        stores={{ overviewStore, settingsStore, transcriptStore }}
        router={createAppRouter(createHashRouter)}
        surface="extension"
        layout={layout}
        activeVideo={activeVideo}
        playback={playback}
        runBridge={runBridge}
        youTubeFetch={youTubeFetch}
      />
    </StrictMode>,
  );
}
