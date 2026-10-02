import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { App, createAppRouter, OutOfDateTab, reportStartupFailure, StartupFailure } from "@overview/app-core";
import {
  IndexedDbOverviewStore,
  IndexedDbSettingsStore,
  IndexedDbSyncStorage,
  LocalDatabaseBlockedError,
  IndexedDbTranscriptStore,
  openLocalDatabase,
} from "@overview/store-local";
import { appBuild } from "./appBuild.js";

async function main() {
  const container = document.getElementById("root");
  if (!container) throw new Error("index.html is missing its #root element");

  // The root is made before the database is opened, so the callback below has something to
  // render into: it fires long after mount, whenever another tab or the worker upgrades.
  const root = createRoot(container);

  let db: IDBDatabase;
  try {
    db = await openLocalDatabase({ onSuperseded: () => root.render(<OutOfDateTab />) });
  } catch (error) {
    console.error(error);
    const blocked = error instanceof LocalDatabaseBlockedError;
    if (!blocked) void reportStartupFailure(error, { surface: "web", build: appBuild });
    root.render(<StartupFailure blocked={blocked} />);
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
        router={createAppRouter(createBrowserRouter)}
        surface="web"
        build={appBuild}
      />
    </StrictMode>,
  );
}

main().catch((error: unknown) => console.error(error));
