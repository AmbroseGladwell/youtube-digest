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
import { adoptLibraryIntoAccount, deleteLocalLibrary, LocalDatabaseBlockedError, openLocalLibrary } from "@overview/store-local";
import { appBuild } from "./appBuild.js";

const main = async () => {
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("index.html is missing its #root element");
  }

  // Made before the database opens: the upgrade callback fires long after mount and needs a root.
  const root = createRoot(container);

  const openLibrary: OpenLibrary = async (accountId, { shown = true } = {}) => {
    const { close, ...stores } = await openLocalLibrary({
      accountId,
      ...(shown ? { onSuperseded: () => root.render(<OutOfDateTab />) } : {}),
    });
    return { accountId, stores, close };
  };

  // Once, for an install signed in before accounts had libraries; a failure is retried next start.
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
    if (!blocked) {
      void reportStartupFailure(error, { surface: "web", build: appBuild });
    }
    root.render(<StartupFailure blocked={blocked} />);
    return;
  }

  root.render(
    <StrictMode>
      <App
        library={library}
        openLibrary={openLibrary}
        deleteLibrary={(accountId) => deleteLocalLibrary({ accountId })}
        router={createAppRouter(createBrowserRouter)}
        surface="web"
        build={appBuild}
      />
    </StrictMode>,
  );
};

main().catch((error: unknown) => console.error(error));
