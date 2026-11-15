import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PLACEHOLDER = /("?)\$\{([A-Z][A-Z0-9_]*)\}("?)/g;
const UNQUOTABLE = /["\\\r\n]/;

// ${NAME} becomes the value of NAME from the environment. Each one sits in double quotes, since
// both readers, `fly secrets import` and Node's --env-file, cut an unquoted value at a "#"; a value
// the quotes cannot carry intact, and a template naming a variable that is not there, are refused
// whole rather than rendered wrong (docs/conventions/secrets.md, "Quoting").
export function renderEnvTemplate(template, env) {
  const missing = new Set();
  const unquoted = new Set();
  const unquotable = new Set();
  const rendered = template.replace(PLACEHOLDER, (_match, open, name, close) => {
    if (open !== '"' || close !== '"') unquoted.add(name);
    const value = env[name];
    if (value === undefined || value === "") {
      missing.add(name);
      return `${open}${close}`;
    }
    if (UNQUOTABLE.test(value)) unquotable.add(name);
    return `${open}${value}${close}`;
  });
  return { rendered, missing: [...missing], unquoted: [...unquoted], unquotable: [...unquotable] };
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [templatePath, outputPath] = process.argv.slice(2);
  if (templatePath === undefined || outputPath === undefined) {
    console.error("usage: node scripts/renderEnv.mjs <template> <output | ->");
    process.exit(2);
  }
  const { rendered, missing, unquoted, unquotable } = renderEnvTemplate(readFileSync(templatePath, "utf8"), process.env);
  const refusals = [
    missing.length > 0 && `names secrets the environment does not carry: ${missing.join(", ")}`,
    unquoted.length > 0 && `has placeholders outside double quotes, write NAME="\${NAME}": ${unquoted.join(", ")}`,
    unquotable.length > 0 && `has values with a quote, backslash or line break, which no reader takes intact: ${unquotable.join(", ")}`,
  ].filter(Boolean);
  if (refusals.length > 0) {
    for (const refusal of refusals) console.error(`${templatePath} ${refusal}`);
    process.exit(1);
  }
  if (outputPath === "-") {
    process.stdout.write(rendered);
  } else {
    writeFileSync(outputPath, rendered, { mode: 0o600 });
    chmodSync(outputPath, 0o600);
  }
}
