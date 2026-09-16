import { App } from "../../src/app/App.js";
import type {} from "../network/iwftWindow.testHelper.js";

// The component playwright.launch() actually mounts. It takes no props of its own —
// props/hooksConfig passed to Playwright CT's mount() are JSON-serialized across the
// Node<->browser boundary, so the live store instances have to be read from the global
// playwright/index.tsx's beforeMount hook already built in the browser, not passed in.
export function IwftAppRoot() {
  return <App stores={window.__iwftStores__} />;
}
