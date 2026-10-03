import { createBrowserRouter } from "react-router";
import { App } from "../../src/app/App.js";
import { createAppRouter } from "../../src/app/createAppRouter.js";
import type {} from "../network/iwftWindow.testHelper.js";

// Module scope, not the component body: a router rebuilt on every render loses the
// navigation state the test just produced.
const router = createAppRouter(createBrowserRouter);
// A magic link lands on a path with the token in its hash; a test gets there the way a
// browser would, by navigating the live router, since the page is mounted before any
// test can set its location (docs/features/sign-in.md).
window.__iwftRouter__ = router;

// The component playwright.launch() actually mounts. It takes no props of its own —
// props/hooksConfig passed to Playwright CT's mount() are JSON-serialized across the
// Node<->browser boundary, so the live store instances have to be read from the global
// playwright/index.tsx's beforeMount hook already built in the browser, not passed in.
export function IwftAppRoot() {
  return (
    <App
      library={window.__iwftLibrary__}
      openLibrary={window.__iwftOpenLibrary__}
      router={router}
      surface={window.__iwftSurface__}
      layout={window.__iwftLayout__}
      activeVideo={window.__iwftActiveVideo__}
      playback={window.__iwftPlayback__}
      runBridge={window.__iwftRunBridge__}
      youTubeFetch={window.__iwftYouTubeFetch__}
      defaultApiUrl={window.__iwftDefaultApiUrl__}
      build={window.__iwftBuild__}
      errorDestinationMirror={
        window.__iwftErrorDestinations__ === null
          ? null
          : (destination) => window.__iwftErrorDestinations__?.push(destination)
      }
    />
  );
}
