import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { App, createAppRouter, OutOfDateTab, StartupFailure } from "@overview/app-core";
import {
  IndexedDbOverviewStore,
  IndexedDbSettingsStore,
  LocalDatabaseBlockedError,
  IndexedDbTranscriptStore,
  openLocalDatabase,
} from "@overview/store-local";

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
        router={createAppRouter(createBrowserRouter)}
        surface="web"
      />
    </StrictMode>,
  );
}

main().catch((error: unknown) => console.error(error));
