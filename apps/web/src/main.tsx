import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import {
  adoptSignedInLibrary,
  App,
  createAppRouter,
  OutOfDateTab,
  readLibraryAccountId,
  reportStartupFailure,
  StartupFailure,
  type Library,
  type OpenLibrary,
} from "@overview/app-core";
import { adoptLibraryIntoAccount, LocalDatabaseBlockedError, openLocalLibrary } from "@overview/store-local";
import { appBuild } from "./appBuild.js";

async function main() {
  const container = document.getElementById("root");
  if (!container) throw new Error("index.html is missing its #root element");

  // The root is made before the database is opened, so the callback below has something to
  // render into: it fires long after mount, whenever another tab or the worker upgrades.
  const root = createRoot(container);

  const openLibrary: OpenLibrary = async (accountId, { shown = true } = {}) => {
    const { close, ...stores } = await openLocalLibrary({
      accountId,
      ...(shown ? { onSuperseded: () => root.render(<OutOfDateTab />) } : {}),
    });
    return { accountId, stores, close };
  };

  // Once, for an install signed in before each account had a library of its own. A failure
  // leaves the library where it was, to be tried again next start.
  try {
    await adoptSignedInLibrary({
      surface: "web",
      moveDatabase: (accountId) => adoptLibraryIntoAccount({ accountId }),
    });
  } catch (error) {
    console.error(error);
    void reportStartupFailure(error, { surface: "web", build: appBuild });
  }

  let library: Library;
  try {
    library = await openLibrary(readLibraryAccountId());
  } catch (error) {
    console.error(error);
    const blocked = error instanceof LocalDatabaseBlockedError;
    if (!blocked) void reportStartupFailure(error, { surface: "web", build: appBuild });
    root.render(<StartupFailure blocked={blocked} />);
    return;
  }

  root.render(
    <StrictMode>
      <App
        library={library}
        openLibrary={openLibrary}
        router={createAppRouter(createBrowserRouter)}
        surface="web"
        build={appBuild}
      />
    </StrictMode>,
  );
}

main().catch((error: unknown) => console.error(error));
