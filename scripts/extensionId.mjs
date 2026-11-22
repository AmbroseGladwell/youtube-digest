import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Chrome's id: the first half of the key's SHA-256, spelt a to p instead of hex.
export const extensionIdFrom = (publicKey) => {
  const hex = createHash("sha256").update(Buffer.from(publicKey, "base64")).digest("hex").slice(0, 32);
  return hex.replace(/[0-9a-f]/g, (digit) => String.fromCharCode(97 + parseInt(digit, 16)));
};

export const extensionOriginFrom = (manifest) => {
  if (typeof manifest.key !== "string" || manifest.key === "") {
    throw new Error(
      "manifest.json carries no key, so its id is not fixed yet: upload a draft to the Web Store and paste the public key it shows (docs/architecture/deploy.md)",
    );
  }
  return `chrome-extension://${extensionIdFrom(manifest.key)}`;
};

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const manifestPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps/extension/manifest.json");
  try {
    console.log(extensionOriginFrom(JSON.parse(readFileSync(manifestPath, "utf8"))));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
