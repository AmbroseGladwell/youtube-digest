import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PLACEHOLDER = /\$\{([A-Z][A-Z0-9_]*)\}/g;

// ${NAME} becomes the value of NAME from the environment, and a template naming a variable
// that is not there is refused whole rather than rendered with a hole in it
// (docs/conventions/secrets.md).
export function renderEnvTemplate(template, env) {
  const missing = new Set();
  const rendered = template.replace(PLACEHOLDER, (_match, name) => {
    const value = env[name];
    if (value === undefined || value === "") {
      missing.add(name);
      return "";
    }
    return value;
  });
  return { rendered, missing: [...missing] };
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [templatePath, outputPath] = process.argv.slice(2);
  if (templatePath === undefined || outputPath === undefined) {
    console.error("usage: node scripts/renderEnv.mjs <template> <output>");
    process.exit(2);
  }
  const { rendered, missing } = renderEnvTemplate(readFileSync(templatePath, "utf8"), process.env);
  if (missing.length > 0) {
    console.error(`${templatePath} names secrets the environment does not carry: ${missing.join(", ")}`);
    process.exit(1);
  }
  writeFileSync(outputPath, rendered, { mode: 0o600 });
  chmodSync(outputPath, 0o600);
}
