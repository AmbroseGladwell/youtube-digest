import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter } from "react-router";
import {
  adoptSignedInLibrary,
  App,
  createAppRouter,
  type ActiveVideoSource,
  type ArticlePages,
  type AppLayout,
  type AppUpdate,
  type PlaybackSource,
  type RunBridge,
  type YouTubeFetch,
  type Library,
  type OpenLibrary,
  OutOfDateTab,
  readLibraryAccountId,
  reportStartupFailure,
  StartupFailure,
} from "@overview/app-core";
import { adoptLibraryIntoAccount, deleteLocalLibrary, LocalDatabaseBlockedError, openLocalLibrary } from "@overview/store-local";
import { writeAccentColour } from "./accentColourStorage.js";
import { appBuild } from "./appBuild.js";
import { chromeProviderPermissions } from "./chromeProviderPermissions.js";
import { writeErrorDestination } from "./errorDestination.js";
import { writeLibraryAccount } from "./libraryAccount.js";
import { PRODUCTION_API_URL } from "./productionApiUrl.js";

export interface MountOptions {
  layout?: AppLayout;
  activeVideo?: ActiveVideoSource | null;
  articlePages?: ArticlePages | null;
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
  articlePages = null,
  playback = null,
  runBridge = null,
  youTubeFetch = null,
}: MountOptions = {}): Promise<void> {
  const container = document.getElementById("root");
  if (!container) throw new Error("the extension document is missing its #root element");

  const root = createRoot(container);

  const openLibrary: OpenLibrary = async (accountId, { shown = true } = {}) => {
    const { close, ...stores } = await openLocalLibrary({
      accountId,
      ...(shown ? { onSuperseded: () => root.render(<OutOfDateTab />) } : {}),
    });
    if (shown) await writeLibraryAccount(accountId);
    return { accountId, stores, close };
  };

  // Once, for an install signed in before each account had a library of its own. A failure
  // leaves the library where it was, to be tried again next start.
  try {
    await adoptSignedInLibrary({
      surface: "extension",
      moveDatabase: (accountId) => adoptLibraryIntoAccount({ accountId }),
    });
  } catch (error) {
    console.error(error);
    void reportStartupFailure(error, { surface: "extension", layout, build: appBuild, defaultApiUrl: PRODUCTION_API_URL });
  }

  let library: Library;
  try {
    library = await openLibrary(readLibraryAccountId());
  } catch (error) {
    console.error(error);
    const blocked = error instanceof LocalDatabaseBlockedError;
    if (!blocked) {
      void reportStartupFailure(error, { surface: "extension", layout, build: appBuild, defaultApiUrl: PRODUCTION_API_URL });
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
        appUpdate={openExtensionsPage}
        router={createAppRouter(createHashRouter)}
        surface="extension"
        layout={layout}
        activeVideo={activeVideo}
        articlePages={articlePages}
        playback={playback}
        runBridge={runBridge}
        youTubeFetch={youTubeFetch}
        providerPermissions={chromeProviderPermissions}
        defaultApiUrl={PRODUCTION_API_URL}
        errorDestinationMirror={writeErrorDestination}
        accentMirror={writeAccentColour}
        build={appBuild}
      />
    </StrictMode>,
  );
}
