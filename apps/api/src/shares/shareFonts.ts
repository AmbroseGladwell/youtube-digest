import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Beside the built output rather than resolved from the repo root, so the same path works
// in the image, where only dist and assets are copied (docs/architecture/deploy.md).
const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "fonts");

export const TITLE_FONT_FAMILY = "Gloock";
export const BODY_FONT_FAMILY = "Figtree";

// The app's own two faces, bundled rather than fetched: a preview crawler will not wait on
// Google Fonts, and the image this runs in has no fonts installed at all
// (docs/features/sharing.md).
export const FONT_FILES = [join(FONT_DIR, "Gloock-Regular.ttf"), join(FONT_DIR, "Figtree-SemiBold.ttf")];
