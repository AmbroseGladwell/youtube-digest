import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from the built output, not the repo root, so the path also works in the image.
const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "fonts");

export const TITLE_FONT_FAMILY = "Gloock";
export const BODY_FONT_FAMILY = "Figtree";

// Bundled, not fetched: docs/features/sharing.md, "The card image".
export const FONT_FILES = [join(FONT_DIR, "Gloock-Regular.ttf"), join(FONT_DIR, "Figtree-SemiBold.ttf")];
