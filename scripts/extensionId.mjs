import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Chrome's id for an extension is the first half of the SHA-256 of its public key, spelt
// in the letters a to p instead of hex digits. The key comes from the Web Store once a
// draft has been uploaded; with it in the manifest, every unpacked build has the store's
// id too (docs/architecture/deploy.md, "The extension").
export function extensionIdFrom(publicKey) {
  const hex = createHash("sha256").update(Buffer.from(publicKey, "base64")).digest("hex").slice(0, 32);
  return hex.replace(/[0-9a-f]/g, (digit) => String.fromCharCode(97 + parseInt(digit, 16)));
}

export function extensionOriginFrom(manifest) {
  if (typeof manifest.key !== "string" || manifest.key === "") {
    throw new Error(
      "manifest.json carries no key, so its id is not fixed yet: upload a draft to the Web Store and paste the public key it shows (docs/architecture/deploy.md)",
    );
  }
  return `chrome-extension://${extensionIdFrom(manifest.key)}`;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const manifestPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../apps/extension/manifest.json",
  );
  try {
    console.log(extensionOriginFrom(JSON.parse(readFileSync(manifestPath, "utf8"))));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
