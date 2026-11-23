import { createBrowserRouter } from "react-router";
import { App } from "../../src/app/App.js";
import { createAppRouter } from "../../src/app/createAppRouter.js";
import type {} from "../network/iwftWindow.testHelper.js";

// Module scope: a router rebuilt on every render loses the navigation state the test produced.
const router = createAppRouter(createBrowserRouter);
// The page mounts before a test can set its location, so a test navigates the live router.
window.__iwftRouter__ = router;

// No props: CT serializes them, so the stores come from the global index.tsx's beforeMount built.
export const IwftAppRoot = () => {
  return (
    <App
      library={window.__iwftLibrary__}
      openLibrary={window.__iwftOpenLibrary__}
      deleteLibrary={window.__iwftDeleteLibrary__}
      router={router}
      surface={window.__iwftSurface__}
      layout={window.__iwftLayout__}
      activeVideo={window.__iwftActiveVideo__}
      articlePages={window.__iwftArticlePages__}
      tiktokPages={window.__iwftTikTokPages__}
      playback={window.__iwftPlayback__}
      runBridge={window.__iwftRunBridge__}
      youTubeFetch={window.__iwftYouTubeFetch__}
      defaultApiUrl={window.__iwftDefaultApiUrl__}
      serverSwitchable={window.__iwftServerSwitchable__}
      build={window.__iwftBuild__}
      errorDestinationMirror={
        window.__iwftErrorDestinations__ === null ? null : (destination) => window.__iwftErrorDestinations__?.push(destination)
      }
      accentMirror={window.__iwftAccentMirror__ === null ? null : (accentColour) => window.__iwftAccentMirror__?.push(accentColour)}
    />
  );
};
