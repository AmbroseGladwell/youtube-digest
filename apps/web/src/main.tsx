import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@overview/app-core";
import {
  IndexedDbOverviewStore,
  IndexedDbSettingsStore,
  openLocalDatabase,
} from "@overview/store-local";

async function main() {
  const container = document.getElementById("root");
  if (!container) throw new Error("index.html is missing its #root element");

  const db = await openLocalDatabase();
  const overviewStore = new IndexedDbOverviewStore(db);
  const settingsStore = new IndexedDbSettingsStore(db);

  createRoot(container).render(
    <StrictMode>
      <App stores={{ overviewStore, settingsStore }} />
    </StrictMode>,
  );
}

main();
