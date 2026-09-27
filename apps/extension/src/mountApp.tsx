import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter } from "react-router";
import {
  App,
  createAppRouter,
  type ActiveVideoSource,
  type AppLayout,
  type AppUpdate,
  type PlaybackSource,
  type RunBridge,
  type YouTubeFetch,
  OutOfDateTab,
  StartupFailure,
} from "@overview/app-core";
import {
  IndexedDbOverviewStore,
  IndexedDbSettingsStore,
  IndexedDbSyncStorage,
  LocalDatabaseBlockedError,
  IndexedDbTranscriptStore,
  openLocalDatabase,
} from "@overview/store-local";
import { PRODUCTION_API_URL } from "./productionApiUrl.js";

export interface MountOptions {
  layout?: AppLayout;
  activeVideo?: ActiveVideoSource | null;
  playback?: PlaybackSource | null;
  runBridge?: RunBridge | null;
  youTubeFetch?: YouTubeFetch | null;
}

// The one thing an extension page can do about being out of date that a web page cannot:
// take the reader to where Chrome updates it (docs/features/record-migrations.md).
const openExtensionsPage: AppUpdate = {
  label: "Open extensions",
  apply: () => void chrome.tabs.create({ url: "chrome://extensions" }),
};

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

  const syncStorage = new IndexedDbSyncStorage(db);
  const overviewStore = new IndexedDbOverviewStore(db, { onJournaled: syncStorage.notifyJournaled });
  const settingsStore = new IndexedDbSettingsStore(db, { onJournaled: syncStorage.notifyJournaled });
  const transcriptStore = new IndexedDbTranscriptStore(db);

  root.render(
    <StrictMode>
      <App
        stores={{ overviewStore, settingsStore, transcriptStore, syncStorage }}
        appUpdate={openExtensionsPage}
        router={createAppRouter(createHashRouter)}
        surface="extension"
        layout={layout}
        activeVideo={activeVideo}
        playback={playback}
        runBridge={runBridge}
        youTubeFetch={youTubeFetch}
        defaultApiUrl={PRODUCTION_API_URL}
      />
    </StrictMode>,
  );
}
